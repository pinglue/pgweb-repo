
import express from "express";
import {Controller} from "pinglue";
import {
    print,
    style,
} from "@pinglue/print/node";
import {
    _cloneFreeze,
    emptyPrint,
    emptyStyle
} from "@pinglue/utils";

import {FrontendSct} from "./frontend-sct.js";
import {ApiSct} from "./api-sct.js";

// TODO: to be removed to a separate pkg
import ReactSct from "./react-sct.js";

export interface Settings extends ControllerSettings {
    env: string;
    apiRoute: string;
    checkFrontend: boolean;
    watchFrontend: boolean;
    buildFrontend: boolean;
    watchBacktend: boolean;
    port: number;
    pgPath: string;
    silent: boolean;

    frontendLogger: "default-pg-print" | "console" | "none";
    backendLogger: "default-pg-print" | "console" | "none";

    fakeApiDelay?: number;

    frontend: {
        filePath?: string;
        url?: string;
        port?: number;
    };

    // for sub controllers and probably other modules
    _print?: Printer;
    _style?: Styler;
};

export default class extends Controller {

    protected settings: Settings;
    private print: Printer;
    private style: Styler;

    async init() {

        // initing print/style

        if (!this.settings.silent) {

            this.print = print;
            this.style = style;

        }
        else {

            this.print = emptyPrint;
            this.style = emptyStyle;

        }

        await this.newSubController(
            "frontend",
            {_print: this.print, _style: this.style},
            FrontendSct
        );

        // TODO: to be removed to a separate pkg
        await this.newSubController(
            "react",
            {_print: print, _style:style},
            ReactSct
        );

        await this.newSubController(
            "api",
            {_print: print, _style:style},
            ApiSct
        );

        // TODO: use report instead of print/style
        //this.glue("report", printReport);



        const settings = _cloneFreeze({
            ...this.settings, 
            _print: this.print, 
            _style: this.style
        });

        // channels

        /*this.regChannel("before-server-starts",{
            runMode: "no-value"
        });*/
        this.regChannel("before-request", {
            runMode: "no-value",
            noCloneParams: true
        });

        this.regChannel("before-api-request", {
            runMode: "no-value",
            noCloneParams: true
        });

        this.regChannel("backend-packages-settings");

        this.regChannel("before-frontend-request", {
            runMode: "no-value",
            noCloneParams: true
        });

        this.regChannel("frontend-packages-settings");

        this.regChannel("request-failed", {
            runMode: "no-value",
            noCloneParams: true
        });

        this.regChannel(`${this.id}/--api-request`, {
            singleHandler: true,
            runMode: "no-value",
            noCloneParams: true
        });

        this.regChannel(`${this.id}/--frontend-request`, {
            singleHandler: true,
            runMode: "no-value",
            noCloneParams: true
        });

        /*this.regChannel("get-server-settings", {
            singleHandler: true,
            syncType: "sync"
        });*/

        this.glue(
            "get-server-settings",
            ()=>settings
        );

    }

    async start() {

        this.print.header("\n\nWelcome to PG web server!!\n\n");
        this.print.mute("Initing ...\n\n");

        // initing plugins
        await this.runA("before-server-starts");

        /* initing the server
        -------------------------- */

        print("Initing the server\n");

        const app = express();

        // before request channel
        app.use(async(req, res, next) => {

            await this.runA("before-request", {req, res});
            next();

        });

        // api req
        const apiRoute = _normalizeRoute(this.settings.apiRoute);
        app.use(apiRoute, async(req, res, next)=>{
            
            this.print.mute(`Api request for: "${req.url}"\n`);

            // fake api delay
            if (this.settings.fakeApiDelay) {
                this.print.mute(`Fake Api delay for dev purpose: ${this.settings.fakeApiDelay}ms\n`);
                await new Promise<void>(res=>setTimeout(
                    ()=>res(),
                    this.settings.fakeApiDelay
                ));
            }

            await this.runA("before-api-request", {req, res});
            if (res.writableEnded) return;
            await this.runA(`${this.id}/--api-request`, {req, res});
            next();

        });
        print.mute(`API route set at "${apiRoute}"\n`);

        // frontend middleware
        app.use(async(req, res, next)=>{

            //this.print.mute(`Frontend request for: "${req.url}"\n`);
            await this.runA("before-frontend-request", {req, res});
            if (res.writableEnded) return;
            await this.runA(`${this.id}/--frontend-request`, {req, res});
            next();

        });

        // failure route
        app.use(async(req, res, next)=>{

            await this.runA("request-failed", {req, res});

            this.print.error(`All routes failed for teh req "${req.url}"\n\n`);
            if (!res.writableEnded)
                res.end("All routes failed! See logs for more details");

        });

        /* starting server
        ---------------------- */

        this.print.mute("\nStarting the server ... ");

        try {

            await new Promise<void>((res, rej)=>{

                app.listen(
                    this.settings.port,
                    () => res()
                ).on("error", error => rej(error));

            });

        }
        catch(error) {

            this.print.error("Failed!", error);
            throw error;

        }

        this.print.success(`Listening at ${this.style.warn(this.settings.port)}\n\n`);

    }

}

/* aux tools
=================================== */

function _normalizeRoute(route: string): string {

    if (route.startsWith("/")) return route;
    else if (route.startsWith("./")) return route.slice(1);
    else return `/${route}`;

}
