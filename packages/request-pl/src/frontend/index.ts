
import axios from "axios";

import type {
    ChannelHandlerMeta
} from "pinglue/browser";

import {Controller} from "pinglue/browser";

import type {
    Message
} from "@pinglue/utils";

import {_default, Msg} from "@pinglue/utils";

import type {RequestService} from "@pgweb/utils/browser";

import {RemoteChanSct} from "./remote-chan-sct.js";

//===================================================

type RequestHandlerParams = {
    request: RequestService;
    files?: {
        [fieldName: string]: Blob[];
    };
    method?: "post" | "get" | "put" | "delete";
};

export default class extends Controller {

    protected processSettings(settings) {

        _default(settings, {apiRoute: "api"});

    }

    async init() {

        this.glue(
            "send-request",
            this.requestHandler.bind(this)
        );

        await this.newSubController(
            "remote-chan",
            RemoteChanSct
        );

    }

    async requestHandler(
        params: RequestHandlerParams,
        _,
        meta: ChannelHandlerMeta
    ): Promise<Message> {

        const {runner: ctId} = meta;

        this.log("msg-sending-request", {ctId});

        const {request, files, method = "post"} = params;

        // checking request
        if (
            !request?.cmd ||
            typeof request.cmd !== "string" ||
            !request.cmd.trim()
        ) {

            this.log.error("err-invalid-request-cmd", {
                cmd: request?.cmd
            });
            return Msg.error("err-invalid-request-cmd", {
                cmd: request?.cmd
            });

        }

        let pgReqStr;

        try {

            pgReqStr = JSON.stringify({
                cmd: request.cmd,
                params: request.params || undefined
            });

        }
        catch(error) {

            this.log.error("err-request-serialization-failed", {
                cmd: request.cmd,
                params: request.params || undefined
            });
            return Msg.error("err-request-serialization-failed", {
                cmd: request.cmd,
                params: request.params || undefined
            });

        }

        // form data
        let data = new FormData();
        let headers = {};

        data.append("pgReq", pgReqStr);

        // appending files
        if (params.files) {

            for (
                const [fieldName, filesInfo] of
                Object.entries(params.files)
            ) {

                for(const file of filesInfo) {

                    data.append(fieldName, file);

                }

            }

        }

        ({data, headers} = await this.runA(
            "before-send-request", null,
            {data, headers}
        ));

        // sending the request now
        try {

            const response = await axios({
                url: `/${this.settings.apiRoute}/${ctId}`,
                data, method
            });

            // handling network errors
            if (response.status !== 200) {

                this.log.error(
                    "err-send-request-failed",
                    {response}
                );
                return Msg.error(
                    "err-send-request-failed",
                    {response}
                );

            }
            // response came
            else {

                this.log.success("suc-response-received", response.data);

                // no payload?
                if (!response.data) {

                    this.log.warn("err-no-payload", {response});
                    return Msg.error("err-no-payload");

                }

                const payload = await this.runA(
                    "response-pre-process",
                    {ctId},
                    response.data
                );

                // no pgres field?
                if (!payload.pgRes) {

                    this.log.warn("err-no-pgres-field", {response});
                    return Msg.error("err-no-pgres-field");

                }

                return payload.pgRes;

            }

        }
        // network error
        catch(error) {

            this.log.error("err-send-request-failed", error);
            return Msg.error(
                "err-send-request-failed"
            );

        }

    }

}
