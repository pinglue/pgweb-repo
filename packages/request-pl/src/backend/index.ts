
import {Msg, _merge, _clone} from "@pinglue/utils";

import type {
    ControllerSettings
} from "pinglue";

import {Controller} from "pinglue";

import type {
    RequestInfo,
    RequestService
} from "@pgweb/utils/node";

import {RemoteChanSct} from "./remote-chan-sct.js";

//====================================================

interface Settings extends ControllerSettings {

    // relative to the plugin dataPath - defaults to tmp-uploads. Use alsolute path to move it off the plugin data path
    uploadDir: string;

    __remoteChannels?: string[];
}

export default class extends Controller {

    protected settings: Settings;

    async init() {

        await this.newSubController(
            "remote-chan",
            RemoteChanSct
        );

        this.glue(
            "api-request",
            this.requestHandler.bind(this)
        );

    }

    async requestHandler(
        _, reqInfo: RequestInfo
    ): Promise<void> {

        const url = reqInfo.reqUrl;

        this.log("msg-incoming-api-request", {
            url
        });

        // validating the request
        /*if (res.writableEnded) {
            this.log.error("err-request-already-sent", {url});
            return;
        }*/

        // extracting the controllerid
        const controllerId = url.split("/")
            .filter(x => !!x.trim())?.[0];

        // TODO: more checks if url belogs to a backend registered controller
        if (!controllerId) {

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-request-no-ct-id-found")
            });

            this.log.error("err-request-no-ct-id-found", {url});

            return;

        }

        // validating pgReq

        const pgReqStr: RequestService = reqInfo.reqBody?.pgReq;

        if (!pgReqStr) {

            this.log.error("err-empty-pgreq-field", {
                url,
                pgReqStr
            });

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-empty-pgreq-field")
            });

            return;

        }

        if (
            typeof pgReqStr !== "string"
        ) {

            this.log.error("err-multi-pgreqs", {
                url,
                pgReqStr
            });

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-multi-pgreqs")
            });

            return;

        }

        // parsing pgreq
        let pgReq: RequestService;

        try {

            pgReq = JSON.parse(pgReqStr);

        }
        catch(error) {

            this.log.error("err-pgreq-json-parse-failed", {
                url,
                pgReqStr
            });

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-pgreq-json-parse-failed")
            });

            return;

        }

        if (!pgReq) {

            this.log.error("err-empty-pgreq-obj", {
                url,
                pgReq
            });
            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-empty-pgreq-obj")
            });
            return;

        }

        if (
            typeof pgReq.cmd !== "string" ||
            !pgReq.cmd.trim()
        ) {

            this.log.error("err-pgreq-cmd-wrong-format", {
                url,
                cmd: pgReq.cmd
            });
            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-pgreq-cmd-wrong-format")
            });
            return;

        }

        /* request flow
        -------------------- */

        //this.mark("reqInfo freez: ", {isFreeze:Object.isFrozen(reqInfo)});

        // step 1
        await this.runA(
            "before-api-request", null, reqInfo
        );

        this.log("msg-ctx-after-pre-process", reqInfo.ctx);

        // step 2
        await this.runA(
            "process-api-req",
            {ctx: reqInfo.ctx, pgReq}, null,
            {filter: controllerId}
        );

        if (!reqInfo.isSent) {

            this.log.error("err-ct-unfinished-process", {
                controllerId,
                url,
                ctxId: reqInfo.ctx.id
            });

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-ct-unfinished-process")
            });

        }

    }

}
