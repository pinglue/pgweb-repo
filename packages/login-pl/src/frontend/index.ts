
import {Msg, _clone, _cloneFreeze} from "@pinglue/utils";
import {FrontendController} from "@pgweb/utils/browser";

import UpSct from "./up-sct.js";

import type {
    LoginData,
    LoginResponse
} from "../commons";

export default class extends FrontendController {

    loginData: null | LoginData = null;

    async init() {

        this.glue(
            this.internalChan("login"),
            this.loginHandler.bind(this)
        );

        this.glue(
            "logout",
            this.logoutHandler.bind(this)
        );

        this.glue(
            "is-logged-in",
            this.isLoggedInHandler.bind(this)
        );

        await this.newSubController(
            "up-sct",
            UpSct
        );

    }

    async loginHandler(params: LoginResponse) {

        if (params.type === "error") {

            this.log.error(
                "err-login-failed", params
            );
            return;

        }

        this.loginData = params.data;

        this.log.success("suc-login", this.loginData);

        await this.runA("logged-in", this.loginData);

    }

    isLoggedInHandler() {

        if (!this.loginData)
            return {loggedIn: false};

        else return {
            loggedIn:true,
            loginData: this.loginData
        };

    }

    async logoutHandler() {

        const res = await this.send("logout");

        if (res.type === "success") {

            this.loginData = null;

            this.log.success("suc-logout");

            await this.runA("logged-out");

        }
        else {

            this.log.error("err-logout-failed", res);

        }

    }

    async start() {

        const res = await this.send("login-data");

        if (res.type === "error") {

            this.log.error(
                "err-login-data-cmd-failed", res
            );

        }
        else {

            this.loginData = _cloneFreeze(res.data);

            if (this.loginData === null)
                await this.runA("logged-out");

            else
                await this.runA(
                    "logged-in",
                    this.loginData
                );

        }

    }

}
