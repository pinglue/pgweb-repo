
import express from "express";
import path from "path";
import {Controller} from "pinglue";

import {
    print,
    style
} from "@pinglue/print/node";

import type {
    Printer,
    Styler,
    Message,
    Object
} from "@pinglue/utils";

import {
    Msg,
    _clone,
    _merge,
    _cloneFreeze,
    emptyPrint,
    emptyStyle
} from "@pinglue/utils";

import type {
    RequestContext
} from "@pgweb/utils/node";

import {CtxRegistry} from "./ctx-registry.js";
import {FrontendSct} from "./frontend-sct.js";
import {BackendSct} from "./backend-sct.js";

import type {
    Settings
} from "./settings";

//==============================================

export default class extends Controller {

    protected settings: Settings;
    print: Printer;
    style: Styler;

    ctxRegistry: CtxRegistry;

    backendSct: BackendSct;
    frontendSct: FrontendSct;

    async init() {

        this.ctxRegistry = new CtxRegistry({
            uploadPath: path.join(
                this.dataPath,
                this.settings.uploadDir || "tmp-uploads"
            )
        });

        // initing print/style

        if (!this.settings.silent) {

            this.print = print;
            this.style = style;

        }
        else {

            this.print = emptyPrint;
            this.style = emptyStyle;

        }

        this.frontendSct = await this.newSubController(
            "frontend",
            {_print: this.print, _style: this.style},
            FrontendSct
        ) as FrontendSct;

        this.backendSct = await this.newSubController(
            "backend",
            {_print: print, _style:style},
            BackendSct
        ) as BackendSct;

        // TODO: use report instead of print/style
        //this.glue("report", printReport);

        // channels

        this.glue(
            "send-response",
            this.sendHandler.bind(this)
        );

        this.glue(
            "get-request-info",
            this.getReqInfoHandler.bind(this)
        );

        this.glue(
            "set-request-info",
            this.setReqInfoHandler.bind(this)
        );

        const settings = _cloneFreeze({
            ...this.settings,
            _print: this.print,
            _style: this.style
        });

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

        // on request channel
        app.use(async(req, res, next) => {

            await this.runA("on-request", {req, res});
            next();

        });

        // static frontend route
        const staticRoute =
            _normalizeRoute(this.settings.staticRoute);
        app.use(staticRoute, this.frdStaticMiddleware.bind(this));
        print.mute(`Static frotnend route set at "${staticRoute}"\n`);

        // api route
        const apiRoute =
            _normalizeRoute(this.settings.apiRoute);
        app.use(apiRoute, this.apiMiddleware.bind(this));
        print.mute(`API route set at "${apiRoute}"\n`);

        // regular frontend route
        app.use(this.frdMiddleware.bind(this));

        // failure route
        app.use(this.failMiddleware.bind(this));

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

    async frdMiddleware(req, res, next) {

        // registering the request
        let reqInfo = await this.ctxRegistry.register(req, res);

        // pre-processing the request
        await this.runA(
            "before-frontend-request", null, reqInfo
        );
        //this.ctxRegistry.update(reqInfo);

        if (!this.isReqSent(reqInfo.ctx)) {

            // pre process the req info using the backend hub
            await this.backendSct.frdReqPreProcess(reqInfo);
            //this.ctxRegistry.update(reqInfo);

            // process if not sent yet
            if (!this.isReqSent(reqInfo.ctx)) {

                await this.frontendSct.frdReqProcess(
                    req, res, reqInfo
                );

            }

        }

        // closing the context
        this.ctxRegistry.close(reqInfo.ctx);

        next();

    }

    async frdStaticMiddleware(req, res, next) {

        await this.frontendSct.frdStaticReqProcess(req, res);

        next();

    }

    async apiMiddleware(req, res, next) {

        this.print.mute(`Api request for: "${req.url}"\n`);

        // fake api delay
        if (this.settings.fakeApiDelay) {

            this.print.mute(`Fake Api delay for dev purpose: ${this.settings.fakeApiDelay}ms\n`);
            await new Promise<void>(resolve=>setTimeout(
                ()=>resolve(),
                this.settings.fakeApiDelay
            ));

        }

        // registering the request
        let reqInfo = await this.ctxRegistry.register(req, res);

        // pre-processing the request
        await this.runA("before-api-request", null, reqInfo);
        //this.ctxRegistry.update(reqInfo);

        if (!this.isReqSent(reqInfo.ctx)) {

            // handing the request to the api hub
            await this.backendSct.apiReqProcess(reqInfo);

        }

        // closing the context
        this.ctxRegistry.close(reqInfo.ctx);

        next();

    }

    async failMiddleware(req, res) {

        this.print.error(`All routes failed for teh req "${req.url}"\n\n`);

        await this.runA("request-not-responded", {req, res});

        if (!res.writableEnded)
            res.end("All routes failed! See logs for more details");

    }

    isReqSent(ctx: RequestContext): boolean {

        const obj = this.ctxRegistry.getReqInfo(ctx);

        return obj?.isSent;

    }

    async sendHandler(
        {ctx, msg}: {
            ctx: RequestContext;
            msg?: Message;
        }
    ): Promise<void> {

        this.log("msg-sending-response", {ctxId:ctx.id});

        // fetching the ctx object
        const ctxObj = this.ctxRegistry.getCtxObj(ctx);

        if (!msg) msg = Msg.success();

        // TODO: in the future we can add more fields to the resBody from the context

        // finalizing the request - running before response sent channel
        await this.runA(
            "before-send-response", null, ctxObj.info
        );

        // adding the pg res msg
        ctxObj.info.resBody.pgRes = msg;

        // serializing the response
        let bodyStr: string;

        try {

            bodyStr = JSON.stringify(ctxObj.info.resBody);

        }
        catch(error) {

            this.log.error("err-response-body-serialization-failed", {
                body: ctxObj.info.resBody
            });
            return;

        }

        ctxObj.res.writeHead(
            ctxObj.info.resStatus, ctxObj.info.resHeaders
        ).end(bodyStr);

        ctxObj.info.isSent = true;

    }

    getReqInfoHandler({ctx}: {ctx: RequestContext}) {

        const reqInfo = this.ctxRegistry.getReqInfo(ctx);

        return _clone(reqInfo);

    }

    setReqInfoHandler(params: {
        ctx: RequestContext;
        reqStatus?: number;
        reqHeaders?: Object;
        resStatus?: number;
        resHeaders?: Object;
        resBody?: Object;
    }) {

        this.ctxRegistry.updateInfo(params);

    }

}

/* aux tools
=================================== */

function _normalizeRoute(route: string): string {

    if (route.startsWith("/")) return route;
    else if (route.startsWith("./")) return route.slice(1);
    else return `/${route}`;

}
