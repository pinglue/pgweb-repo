
import cookie, { CookieSerializeOptions } from "cookie";
import uid from "uid-safe";

import type {
    ChannelHandlerMeta
} from "pinglue";

import {BackendController} from "@pgweb/utils/node";

import type {
    Message
} from "@pinglue/utils";

import {Msg} from "@pinglue/utils";

import type {
    RequestContext,
    RequestInfo
} from "@pgweb/utils/node";

import RedisSct from "./redis-sct.js";

import type {
    Settings
} from "./settings";

//=========================================

type GetSessionParams = {
    ctx: RequestContext;
    key: string;

};

type SetSessionParams = {
    ctx: RequestContext;
    key: string;
    value: any;
};

const MAX_UID_ATTEMPTS = 10000;

export default class extends BackendController {

    protected settings: Settings;

    // used to distinguish the old keys
    hash = Date.now();

    async init() {

        this.glue(
            "get-session",
            this.getSessionHandler.bind(this)
        );

        this.glue(
            "set-session",
            this.setSessionHandler.bind(this)
        );

        // gluings

        this.glue(
            "before-api-request",
            this.beforeApiHandler.bind(this)
        );

        // sct
        await this.newSubController(
            "redis",
            RedisSct
        );

    }

    getSessionCookie(
        ctx: RequestContext
    ): string | undefined {

        const {reqHeaders: headers} = this.runS(
            "get-request-info", {ctx}
        );

        //this.mark("headers: ", headers);

        if (!headers) {

            this.log.warn("warn-empty-req-headers-obj", {
                headers
            });

        }

        const obj = cookie.parse(headers?.cookie || "");

        return obj[this.settings.cookieName];

    }

    /**
     * @returns sid of the new session
     * @throws
     */
    async createSession(): Promise<string> {

        for(let i = 0;i < MAX_UID_ATTEMPTS; i++) {

            const sid = `${this.hash}::` +
                await uid(this.settings.sidLength);

            // add it to the store
            const res = await this.runA(
                this.internalChan("add-session"),
                {sid}
            );

            if (res === true) return sid;
            else if (res === false) continue;
            else {

                throw Msg.error(
                    "err-store-add-session-invalid-response", {response: res}
                );

            }

        }

        throw Msg.error(
            "err-add-sess-add-attempts-collide"
        );

    }

    setSessionCookie(ctx: RequestContext, sid: string) {

        const options: CookieSerializeOptions = {
            path: "/",
            httpOnly: false
        };

        // TODO: more options

        if (this.settings.sessionMaxAge)
            options.maxAge = this.settings.sessionMaxAge;

        this.runS("set-request-info", {
            ctx,
            resHeaders: {
                "Set-Cookie": cookie.serialize(
                    this.settings.cookieName,
                    sid,
                    options
                )
            }
        });

    }

    async beforeApiHandler(_, reqInfo: RequestInfo) {

        /*this.mark("I got ctx", ctx);

        const headers = this.runS(
            "get-request-headers", {ctx}
        );

        this.mark("Request headers:", headers);*/

        const {ctx} = reqInfo;

        let sid: string = this.getSessionCookie(ctx);

        // session found
        if (this.isSessionValid(sid)) {

            this.log("msg-session-retrieved", {sid});

        }
        // no (valid) session
        else {

            if (sid)
                this.log("msg-session-invalid", {sid});
            else
                this.log("msg-no-session-found");

            sid = await this.createSession();
            this.setSessionCookie(ctx, sid);
            this.log("msg-new-session-created", {sid});

        }

        return {ctx:{sid}};

    }

    isSessionValid(sid: string): boolean {

        return !!(sid?.startsWith(this.hash + "::"));

    }

    ctxContainsSession(
        ctx: RequestContext
    ): boolean {

        if (!ctx.sid) {

            this.log.warn(
                "warn-session-not-inited-when-session-op",
                {ctx}
            );
            return false;

        }
        return true;

    }

    async getSessionHandler(
        params: GetSessionParams, _,
        meta: ChannelHandlerMeta
    ): Promise<string> {

        const {ctx, key} = params;

        if (!this.ctxContainsSession(ctx))
            return;

        const sessKey = _calcKey(key, meta.runner);

        if (!sessKey) {

            this.log.error(
                "msg-empty-key-when-get-session",
                {key, ctId:meta.runner}
            );
            return;

        }

        return this.runA(
            this.internalChan("get-key"),
            {sid:ctx.sid, key}
        );

    }

    async setSessionHandler(
        params: SetSessionParams, _,
        meta: ChannelHandlerMeta
    ): Promise<Message> {

        const {ctx, key, value} = params;

        if (!this.ctxContainsSession(ctx))
            return;

        const sessKey = _calcKey(key, meta.runner);

        if (!sessKey) {

            this.log.error(
                "msg-empty-key-when-set-session",
                {key, ctId:meta.runner}
            );
            return;

        }

        return this.runA(
            this.internalChan("set-key"),
            {sid: ctx.sid, key, value}
        );

    }

}

function _calcKey(
    key?: string, ctId?: string
) {

    if (!key || !ctId) return null;
    else return `${ctId}::${key}`;

}