
import {Controller} from "pinglue/browser";

import type {
    Message
} from "@pinglue/utils";

//==================================

export class FrontendController extends Controller {

    /* backend communcation
    =================================== */

    /**
     * Requesting server
     * @param cmd
     * @param params
     * @param files
     * @param method
     * @returns
     */
    async send(
        cmd: string,
        params?: Object,
        files?: {
            [fieldName: string]: Blob[];
        },
        method: "post" | "get" | "put" | "delete" = "post"
    ): Promise<Message> {

        this.log("msg-sending-request", {cmd, params, files, method});

        return this.runA(
            "send-request",
            {
                request: {cmd, params},
                files, method
            }
        ) as Message;

    }

    /* set/get app storage data
    =================================== */

    async setAppVar(name, value) {

        await this.runA("set-app-var", {name, value});

    }

    async getAppVar(name) {

        return this.runA("get-app-var", {name});

    }

}