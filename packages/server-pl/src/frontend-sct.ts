
import fs from "fs-extra";
import path from "path";
import express from "express";

import {
    createProxyMiddleware
} from "http-proxy-middleware";

import type {
    RequestInfo
} from "@pgweb/utils/node";

import {
    PgFactoryCodeGen
} from "@pgweb/utils/node";

import type {
    RegistryWatchEvent
} from "pinglue";

import {Controller} from "pinglue";

import type {
    Printer,
    Styler
} from "@pinglue/utils";

import {Msg} from "@pinglue/utils";

import type {
    Settings
} from "./settings";

//===================================

const FRONTEND_ROUTE = "frontend";
const FACTORY_FILENAME = "hub-factory.js";

type Middleware = (req: any, res: any, next: Function) => void;

export class FrontendSct extends Controller {

    protected settings: Settings;
    private print: Printer;
    private style: Styler;
    private frdCodeFactory: PgFactoryCodeGen;
    private factoryCodePath: string;

    private frdMiddleware: Middleware;

    // watch tools
    private isFrontendValid = false;

    async init() {

        this.print = this.settings._print;
        this.style = this.settings._style;

        this.factoryCodePath = path.join(
            this.settings.pgPath,
            FACTORY_FILENAME
        );

        // initing middleware

        // frontend req - proxy
        if (this.settings.frontend?.url) {

            const url = _buildUrl(
                this.settings.frontend.url,
                this.settings.frontend.port
            );

            this.frdMiddleware = createProxyMiddleware({
                target: url,
                ws: true,
                changeOrigin: true
            }) as Middleware;

            this.print.mute(`Frontend will proxy to "${url}"\n`);

        }
        // frontend req - file path
        else if (this.settings.frontend?.filePath) {

            const filePath = path.normalize(
                this.settings.frontend.filePath
            );

            this.frdMiddleware = express.static(filePath);

            this.print.mute(`Frontend is served from the file path "${filePath}"\n`);

        }

        else {
            this.log.error("err-no-frontend-option", {
                frontend: this.settings.frontend
            });
            this.frdMiddleware = (req, res) => {
                res.end(`
                    <h1 style="color:red">
                        No frontend option set! 
                    </h1>
                    <p>
                        Set a frontend option via the settings in @pgweb/server-pl (either serving from file system or proxying to another frontend/CDN server)
                    </p>
                `);       
            }
        }

        // gluings
        this.glue("before-server-starts",
            this.beforeServerHandler.bind(this));

        this.glue("before-frontend-request",
            this.beforeFrdReqHandler.bind(this));

    }

    /**
     *
     */
    async beforeServerHandler() {

        // initing code factory
        if (this.settings.buildFrontend) {

            this.print.header("\nIniting the frontend code factory ... ");

            try {

                this.frdCodeFactory = new PgFactoryCodeGen({
                    localLoggerType: this.settings.frontendLogger,
                    watchSettings: this.settings.watchFrontend,
                    print: this.print,
                    style: this.style,
                    env: this.settings.env,
                    noDataPath: true
                }, FRONTEND_ROUTE);
                await this.frdCodeFactory.init();

            }
            catch(error) {

                this.print.error("Building frontend code factory failed!", error);
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

            this.print.info(`Code factory will be written to ${this.style.hl(this.factoryCodePath)}\n`);
            await this.writeFactoryCode();
            this.print("\n\n");

        }
        //else this.isFrontendValid = true;

    }

    /**
     *
     * @param event
     */
    private onFrdSettingsChanged(event: RegistryWatchEvent) {

        this.print.mute(`Frontend settings update detected at the file: "${event.filePath || "NA"}"\n`);

        this.isFrontendValid = false;

    }

    /**
     * @throws
     */
    private async writeFactoryCode() {

        const packagesSettings = await this.runA(
            "frontend-packages-settings"
        );

        const code = this.frdCodeFactory.getCode({
            packagesSettings
        });

        this.print(`\nWriting code factory at "${this.factoryCodePath}" ... `);

        try {

            await fs.ensureFile(this.factoryCodePath);
            await fs.writeFile(
                this.factoryCodePath,
                code
            );

        }
        catch(error) {

            this.print.error("Failed!", error);
            return;

        }

        this.isFrontendValid = true;
        this.print.success("Done!\n");

    }

    async beforeFrdReqHandler(
        _,
        value: RequestInfo
    ) {

        // TODO: if settings.checkFrontend then run frontend-request channel of the backend hub

        // no need to update
        if (
            !this.settings.watchFrontend ||
            this.isFrontendValid
        ) return;

        this.print.mute("Update needed for the frontend - updating ...\n");

        try {

            await this.frdCodeFactory.init();
            await this.writeFactoryCode();
            this.print.success("Frontend updated!\n\n");

            // wait a bit for the frontend web builder to update
            await new Promise<void>((resolve)=>
                setTimeout(()=>resolve(), 100)
            );

        }
        catch(error) {

            this.print.error("Frontend update failed!", error);

            await this.runA("send-response", {
                ctx: value.ctx,
                msg: Msg.error("err-frontend-update-failed")
            });

        }

    }

    async frdStaticReqProcess(req, res) {

        await new Promise<void>(resolve=>{

            this.frdMiddleware(req, res, resolve);

        });

    }

    async frdReqProcess(req, res, reqInfo: RequestInfo) {

        // TODO: apply the reqInfo to req,res before sending them into the middleware (how?)

        await new Promise<void>(resolve=>{

            this.frdMiddleware(req, res, resolve);

        });

    }

}

/* Aux functions
=================== */

function _buildUrl(url: string, port?: number): string {

    // normalizing the url
    if (url.endsWith("/")) url = url.slice(0, -1);

    if (typeof port !== "undefined")
        return `${url}:${port}`;
    else
        return url;

}
