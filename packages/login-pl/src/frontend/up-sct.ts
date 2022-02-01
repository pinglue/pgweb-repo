
import {FrontendController} from "@pgweb/utils/browser";

import type {
    LoginUpParams
} from "../commons";

//================================

export default class extends FrontendController {

    async init() {

        this.glue(
            "login-up",
            this.loginHandler.bind(this)
        );

    }

    async loginHandler(params: LoginUpParams) {

        const res = await this.send("login-up", params);

        await this.runA(
            this.internalChan("login"), res
        );

        return res;

    }

}