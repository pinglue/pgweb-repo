
import type {
    RequestContext
} from "@pgweb/utils/node";

import {
    BackendController,
    ObjectId
} from "@pgweb/utils/node";

import {_clone} from "@pinglue/utils";

import UpSct from "./up-sct.js";

import type {
    LoginResponse
} from "../commons";

//===========================================

const SESSION_KEY = "user-id";
const LOGIN_DATA_KEY = "login-data";

export default class extends BackendController {

    //loginData:null|LoginData = null;

    async init() {

        // internal channel, to be used by all the sub controllers to login
        this.glue(
            this.internalChan("login"),
            this.loginHandler.bind(this)
        );

        this.glue(
            "get-user-id",
            this.getUserIdHandler.bind(this)
        );

        this.cmdMap
            .set("logout", this.cmdLogout.bind(this))
            .set("login-data", this.cmdLoginData.bind(this));

        await this.newSubController("up-sct", UpSct);

    }

    async getUserIdHandler(
        params: {ctx: RequestContext}
    ): Promise<ObjectId | undefined> {

        const res = await this.getSession(
            params.ctx, SESSION_KEY
        );

        if (!res) return;
        else return new ObjectId(res);

    }

    async loginHandler(
        params: {
            ctx: RequestContext;
            userId?: string;
            response: LoginResponse;
        }
    ) {

        const {ctx, response, userId} = params;

        const finalResponse = _clone(response);

        // failed
        if (finalResponse.type === "error") {

            await this.runA(
                "login-failed",
                {ctx, userId},
                finalResponse
            );

            await this.send.error(
                ctx,
                finalResponse
            );

        }

        // success
        else if (userId && typeof userId === "string") {

            await this.setSession(
                ctx,
                SESSION_KEY,
                userId
            );

            await this.runA(
                "login-success",
                {ctx, userId},
                finalResponse
            );

            await this.setSession(
                ctx, LOGIN_DATA_KEY,
                JSON.stringify(finalResponse.data)
            );
            //this.loginData = finalResponse.data as LoginData;

            await this.runA(
                "logged-in",
                {ctx}
            );

            await this.send(ctx, finalResponse);

        }

        else {

            this.log.error("err-wrong-user-id-format", {userId});
            await this.send.error(ctx, "err-internal");

        }

    }

    async cmdLogout(
        ctx: RequestContext
    ): Promise<void> {

        await this.unsetSession(ctx, SESSION_KEY);
        await this.unsetSession(ctx, LOGIN_DATA_KEY);

        await this.runA("logged-out", {ctx});
        await this.send(ctx);

    }

    async cmdLoginData(
        ctx: RequestContext
    ): Promise<void> {

        const dataStr = await this.getSession(ctx, LOGIN_DATA_KEY);

        //this.mark("data str is", {dataStr});

        let data;

        try {

            data = (!dataStr) ? undefined : JSON.parse(dataStr);

        }
        catch(error) {

            this.log.error(
                "err-login-data-session-json-parse-failed", {
                    dataStr
                }
            );

        }

        //this.mark("login data to be sent", {data});

        await this.send.success(ctx, "", data);

    }

}
