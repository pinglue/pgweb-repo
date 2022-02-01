
import session from "express-session";
import connectRedis from "connect-redis";
import { RequestHandler } from "express";

import {BackendController} from "@pgweb/utils/node";
import {Msg} from "@pinglue/utils";


type Settings = {
    secret: string,
    store: string
}

type GetSessionParams = {
    ctx: RequestContext
    key: string
}

type SetSessionParams = {
    ctx: RequestContext
    key: string
    value: any
}



export default class extends BackendController {

    protected settings: Settings;


    // any error that prevented initing session plugin
    initMdError: any;
    middleware: RequestHandler;


    async init() {
        await super.init();

        this.regChannel("get-session", {
            singleHandler: true,
        });
        this.regChannel("set-session", {
            singleHandler: true,
        });

        this.glue(
            "get-session", 
            this.getSessionHandler.bind(this)
        );

        this.glue(
            "set-session", 
            this.setSessionHandler.bind(this)
        );

    }

    /**
     * 
     * @returns 
     * @throws if initiation fails
     */
    async initMiddleware() {

        let store;

        switch(this.settings.store) {

            case "redis": {

                const RedisStore = connectRedis(session);
                const client = 
                    await this.runA("get-redis-client");

                if (!client) 
                    throw Msg.error("err-no-redis-client");                    
                
                store = new RedisStore({
                    client,
                    prefix: `${this.id}:`
                });

                break;
            }

            default: {
                throw Msg.error(
                    "err-store-not-found", 
                    {name: this.settings.store}
                );
            }           
        }

        if (!store) {
            throw Msg.error("err-store-constructor-failed", {
                storeName: this.settings.store,
                store
            });
        }

        this.middleware = session({
            store,
            secret: String(this.settings.secret),            
            saveUninitialized: false,
            resave: true,
            name: this.id
        });

        if (!this.middleware) {
            throw Msg.error("err-middle-constructor-failed", {
                middleware: this.middleware
            });
        }

        this.log.success("suc-init-session-middleware");
    }


    /**
     * 
     * @param ctx 
     * @returns 
     * @throws
     */
    async initSession(ctx: RequestContext) {

        if (this.initMdError) return;

        // initing middleware
        if (!this.middleware) {
            try {
                await this.initMiddleware();
            }
            catch(error) {
                this.initMdError = error;
                this.log.error("err-session-md-init-failed", error);
                throw Msg.error("err-session-md-init-failed");
            }
        }

        // applying the middleware
        try {           
            
            await new Promise<void>((res, rej) => {
                this.middleware(ctx.req, ctx.res, error => {
                    if (error) rej(error);
                    else res();
                });
            });

        }
        catch(error) {
            this.log.error("err-session-md-failed", error);
            throw Msg.error("err-session-md-failed");
        }
    }

    /**
     * 
     * @param ctx 
     * @returns 
     * @throws
     */
    async checkSession(ctx: RequestContext) {

        if (!ctx?.req)
            throw Msg.error("err-empty-req", {ctx});

        // check if session is initiated
        if (!ctx.req.session) 
            await this.initSession(ctx);
        
        // again!
        if (!ctx.req.session) 
            throw Msg.error("err-session-still-undefined");
    }

    async getSessionHandler(
        params: GetSessionParams, _,
        meta: ChannelHandlerMeta
    ) {

        const {key, ctx} = params;
        this.log("msg-getting-session", {key, ctxId:ctx.id});

        if (this.initMdError) return;
        

        try {            
            const sessKey = _calcKey(key, meta.runner);
            if (!sessKey) {
                this.log.error("msg-empty-session-key", {key, ctId:meta.runner});
                return;
            }
            await this.checkSession(ctx);
            return ctx.req.session[key];
        }
        catch(error) {
            this.log.error("err-get-session-failed", error);
        }
    }


    async setSessionHandler(
        params: SetSessionParams, _,
        meta: ChannelHandlerMeta
    ) {


        const {key, value, ctx} = params;

        this.log("msg-setting-session", {
            key, value, ctxId: ctx.id
        });

        if (this.initMdError) return;

        try {

            const sessKey = _calcKey(key, meta.runner);
            if (!sessKey) {
                this.log.error("msg-empty-session-key", {key, ctId:meta.runner});
                return;
            }

            await this.checkSession(ctx);            

            if (typeof value === "undefined")
                delete ctx.req.session[sessKey];
            else
                ctx.req.session[sessKey] = value;

            // check if response has already sent. If yes we need to save the session manually into the store
            if (ctx.res.writableEnded) {
                this.log.warn("war-session-set-after-response-sent", {key});
                await new Promise<void>((res, rej) => {
                    ctx.req.session.save(error => {
                        if (error) rej(error);
                        else res();
                    });
                });
            }
        }
        catch(error) {
            this.log.error("err-get-session-failed", error);
        }
    }   
}


function _calcKey(
    key?: string, ctId?: string
) {
    if (!key || !ctId) return null;
    else return `${ctId}:${key}`;
}