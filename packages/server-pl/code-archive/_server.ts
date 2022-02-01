
import express from "express";
import fs from "fs-extra";
import path from "path";
import {
    createProxyMiddleware,
    Filter,
    Options,
    RequestHandler
} from "http-proxy-middleware";

import {Controller, Hub, Factory} from "pinglue";
import {print, style, printLog} from "@pinglue/print/node";
import {
    Msg,
    emptyPrint,
    emptyStyle,
    consoleMessenger
} from "@pinglue/utils";
import {PgFactoryCodeGen} from "@pgweb/utils/node";

const FACTORY_FILENAME = "factory.js";
const FRONTEND_ROUTE = "frontend";
const BACKEND_ROUTE = "backend";

type Settings = {
    env?: string;
    apiRoute: string;
    watchFrontend: boolean;
    buildFrontend: boolean;
    watchBacktend: boolean;
    port: number;
    pgPath: string;
    silent: boolean;

    frontendLogger: "default-pg-print" | "console" | "none";
    backendLogger: "default-pg-print" | "console" | "none";

    frontend: {
        filePath?: string;
        url?: string;
        port?: number;
    };
};

export default class extends Controller {

    protected settings: Settings;
    private print: Printer;
    private style: Styler;
    private frdCodeFactory: PgFactoryCodeGen;
    private factoryCodePath: string;
    private bkdHub: Hub;
    private bkdFactory: Factory;

    // watch tools
    private isFrontendValid = false;
    private isBackendValid = false;

    async init() {

        // initing print

        if (!this.settings.silent) {

            this.print = print;
            this.style = style;

        }
        else {

            this.print = emptyPrint;
            this.style = emptyStyle;

        }

        this.factoryCodePath = path.join(
            this.settings.pgPath,
            FACTORY_FILENAME
        );

    }

    async start() {

        this.print.header("\n\nPG web server started!\n\n");

        // initing code factory
        if (this.settings.buildFrontend) {

            this.print.header("Initing the frontend code factory ... ");

            try {

                this.frdCodeFactory = new PgFactoryCodeGen({
                    localLoggerType: this.settings.frontendLogger,
                    watchSettings: this.settings.watchFrontend,
                    print: this.print,
                    style: this.style,
                    env: this.settings.env
                }, FRONTEND_ROUTE);
                await this.frdCodeFactory.init();

            }
            catch(error) {

                print.error("Building frontend code factory!", error);
                throw error;

            }
            this.print.success("Frontend code factory built!\n\n");

        }

        // watching code factory
        if (this.settings.watchFrontend &&
            this.frdCodeFactory) {

            this.frdCodeFactory.on(
                "change-settings",
                this.onFrdSettingsChanged.bind(this)
            );

            this.print.info("Watching for the frontend changes.\n\n");

        }

        // code factory initial writing
        if (this.settings.buildFrontend) {

            this.print.info(`Code factory will be written to ${style.hl(this.factoryCodePath)}\n`);
            await this.writeFactoryCode();
            this.print("\n\n");

        }

        // building backend hub
        this.print.header("\nBuilding the backend hub ... \n");

        try {

            this.bkdFactory = new Factory(BACKEND_ROUTE, {
                env: this.settings.env,
                print: this.print,
                style: this.style,
                watchSettings: this.settings.watchBacktend,
                watchSource: this.settings.watchBacktend
            });

            await this.initBkdHub();

        }
        catch(error) {

            this.print.error("Building the backend hub failed!\n\n", error);
            throw error;

        }

        // watching the backend
        if (this.settings.watchBacktend &&
            this.bkdFactory
        ) {

            this.bkdFactory.on("change",
                this.onBkdChanged.bind(this));

            this.print.info("Watching for the backend changes.\n\n");

        }

        /* server init
        ------------------------ */

        print("Initing the server\n");

        const app = express();

        // api req
        const apiRoute = _normalizeRoute(this.settings.apiRoute);
        app.use(
            apiRoute,
            this.onApiRequest.bind(this)
        );
        print.mute(`API route set at "${apiRoute}"\n`);

        // frontend code update middleware
        if (this.settings.watchFrontend)
            app.use(this.frdUpdate.bind(this));

        // frontend req - proxy
        if (this.settings.frontend.url) {

            const url = _buildUrl(
                this.settings.frontend.url,
                this.settings.frontend.port
            );

            app.use(
                createProxyMiddleware({
                    target: url,
                    ws: true,
                    changeOrigin: true
                })
            );
            print.mute(`Frontend will proxy to "${url}"\n`);

        }
        // frontend req - file path
        else if (this.settings.frontend.filePath) {

            const filePath = path.normalize(
                this.settings.frontend.filePath
            );

            app.use("/", express.static(filePath));

            print.mute(`Frontend is served from the file path "${filePath}"\n`);

        }

        // starting server
        this.print.mute("Starting the server ... ");

        try {

            await new Promise((res, rej)=>{

                app.listen(
                    this.settings.port,
                    () => res(undefined)
                ).on("error", error => rej(error));

            });

        }
        catch(error) {

            this.print.error("Failed!", error);
            throw error;

        }

        this.print.success(`Listening at ${this.style.warn(this.settings.port)}\n\n`);

    }

    async frdUpdate(req, res, next) {

        if (this.isFrontendValid) {

            next();
            return;

        }

        this.print.mute("Update needed for the frontend - updating ...\n");

        try {

            await this.frdCodeFactory.init();
            await this.writeFactoryCode();
            this.print.success("Frontend updated!\n\n");

            // wait a bit for the frontend web builder to update
            setTimeout(()=>next(), 100);

        }
        catch(error) {

            this.print.error("Frontend update failed!", error);
            res.end("Frontend update failed! see the console for error detail!");

        }

    }

    private async onApiRequest(req, res) {

        this.print.mute(`Api request on: ${req.url}\n`);

        if (this.settings.watchBacktend &&
            !this.isBackendValid
        ) {

            this.print.mute("Update needed for the backend - updating ...\n");

            try {

                await this.initBkdHub();
                this.print.success("Backend updated!\n\n");

            }
            catch(error) {

                this.print.error("Backend update failed!", error);
                res.end(JSON.stringify(
                    Msg.error("err-backend-update-failed")
                ));
                return;

            }

        }

        // sending the request into the backend hub
        try {

            await this.bkdHub.runA(
                "incoming-request",
                {res, req}
            );

        }
        catch(error) {

            this.print.error(
                "err-pg-backend-incoming-req-exception",
                error
            );

        }

        // res not sent yet?
        if (!res.writableEnded) {

            this.print.mute("Request not finished by pg backend hub\n");
            res.end(JSON.stringify(Msg.error("err-pg-backend-not-sent-response")));

        }

    }

    private onFrdSettingsChanged(event: RegistryWatchEvent) {

        this.print.mute(`Frontend settings update detected at the file: "${event.filePath || "NA"}"\n`);

        this.isFrontendValid = false;

    }

    private onBkdChanged(event: RegistryWatchEvent) {

        this.print.mute(`Backend update detected at the file: "${event.filePath || "NA"}"\n`);

        this.isBackendValid = false;

    }

    /**
     * @throws
     */
    private async writeFactoryCode() {

        const code = this.frdCodeFactory.getCode();

        this.print(`\nWriting code factory at "${this.factoryCodePath}" ... `);

        try {

            await fs.ensureFile(this.factoryCodePath);
            await fs.writeFile(
                this.factoryCodePath,
                code
            );

        }
        catch(error) {

            print.error("Failed!", error);
            return;

        }

        this.isFrontendValid = true;
        this.print.success("Done!\n");

    }

    private async initBkdHub() {

        this.print.mute("Initing backend hub factory ... \n");
        await this.bkdFactory.init();

        let localLoggers;

        switch (this.settings.backendLogger) {

            case "console":
                localLoggers = consoleMessenger;
                break;
            case "default-pg-print":
                localLoggers = printLog;

        }

        this.bkdHub = this.bkdFactory.getHub({
            localLoggers
        }).hub;

        this.print.mute("Initing the backend hub ... \n");
        await this.bkdHub.init();

        this.print.mute("Starting the backend hub ... \n");
        await this.bkdHub.start();

        this.isBackendValid = true;
        this.print.success("Backend hub built and started!\n\n");

    }

}

/* aux tools
=================================== */

function _normalizeRoute(route: string): string {

    if (route.startsWith("/")) return route;
    else if (route.startsWith("./")) return route.slice(1);
    else return `/${route}`;

}

function _buildUrl(url: string, port?: number): string {

    // normalizing the url
    if (url.endsWith("/")) url = url.slice(0, -1);

    if (typeof port !== "undefined")
        return `${url}:${port}`;
    else
        return url;

}