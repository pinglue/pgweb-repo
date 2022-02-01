
import type {
    Printer,
    Styler
} from "@pinglue/utils";

import {
    Msg,
    consoleMessenger
} from "@pinglue/utils";

import type {
    RequestInfo
} from "@pgweb/utils/node";

import type {
    RegistryWatchEvent
} from "pinglue";

import {Controller, Hub, Factory} from "pinglue";

import {printLog} from "@pinglue/print/node";

import type {
    Settings
} from "./settings";

//===============================================

const BACKEND_ROUTE = "backend";

export class BackendSct extends Controller {

    protected settings: Settings;
    private print: Printer;
    private style: Styler;
    private bkdHub: Hub;
    private bkdFactory: Factory;

    // watch tools
    private isBackendValid = false;

    async init() {

        this.print = this.settings._print;
        this.style = this.settings._style;

        // gluings
        this.glue("before-server-starts",
            this.beforeServerHandler.bind(this));
        this.glue("before-api-request",
            this.beforeApiReqHandler.bind(this));

    }

    /**
     *
     */
    async beforeServerHandler() {

        // building backend hub
        this.print.header("\nBuilding the backend hub ... \n");

        try {

            this.bkdFactory = new Factory(BACKEND_ROUTE, {
                env: this.settings.env,
                profiles: this.settings.profiles,
                print: this.print,
                style: this.style,
                watchSettings: this.settings.watchBacktend,
                watchSource: this.settings.watchBacktend
            });

            await this.initBkdHub();

        }
        catch(error) {

            this.print.error("Building the backend hub failed!\n\n", error);
            throw error;

        }

        // watching the backend
        if (this.settings.watchBacktend &&
            this.bkdFactory
        ) {

            this.bkdFactory.on("change",
                this.onBkdChanged.bind(this));

            this.print.info("Watching for the backend changes.\n\n");

        }

    }

    /**
     *
     * @param event
     */
    private onBkdChanged(event: RegistryWatchEvent) {

        this.print.mute(`Backend update detected at the file: "${event.filePath || "NA"}"\n`);

        this.isBackendValid = false;

    }

    /**
     *
     */
    private async initBkdHub() {

        this.print.mute("Initing backend hub factory ... \n");
        await this.bkdFactory.init();

        let localLoggers;

        switch (this.settings.backendLogger) {

            case "console":
                localLoggers = consoleMessenger;
                break;
            case "default-pg-print":
                localLoggers = printLog;

        }

        const packagesSettings = await this.runA(
            "backend-packages-settings"
        );

        this.bkdHub = this.bkdFactory.getHub({
            hubId: "backend-hub",
            localLoggers,
            packagesSettings
        }).hub;

        this.print.mute("Initing the backend hub ... \n");
        await this.bkdHub.init();

        // gluing server proxy channels
        this.print.mute("Handling server-pl proxy channels in the backend hub ... \n");

        for (const channelName of [
            "send-response",
            "get-request-info",
            "set-request-info"
        ]) {

            if (channelName === "send-response") {

                this.bkdHub.glue(
                    channelName,
                    async(params, value) =>
                        this.runA(channelName, params, value)
                );

            }
            else {

                this.bkdHub.glue(
                    channelName,
                    (params, value) =>
                        this.runS(channelName, params, value)
                );

            }

            this.print.mute(channelName + " Done!\n");

        }

        this.print("\n");

        this.print.mute("Starting the backend hub ... \n");
        await this.bkdHub.start();

        this.isBackendValid = true;
        this.print.success("Backend hub built and started!\n\n");

    }

    private async beforeApiReqHandler(
        _,
        value: RequestInfo
    ) {

        //const {res} = params;

        // no need to update
        if (!this.settings.watchBacktend ||
            this.isBackendValid
        ) return;

        this.print.mute("Update needed for the backend - updating ...\n");

        try {

            await this.initBkdHub();
            this.print.success("Backend updated!\n\n");

        }
        catch(error) {

            this.print.error("Backend update failed!", error);

            await this.runA("send-response", {
                ctx: value.ctx,
                msg: Msg.error("err-backend-update-failed")
            });

            return;

        }

    }

    async apiReqProcess(reqInfo: RequestInfo) {

        //this.mark("reqInfo.ctx frozen in api process: ", Object.isFrozen(reqInfo.ctx));

        // sending the request into the backend hub
        try {

            await this.bkdHub.runA(
                "api-request", null, reqInfo
            );

        }
        catch(error) {

            /*this.print.error(
                "err-pg-backend-incoming-req-exception",
                error
            );*/

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-pg-backend-api-req-exception")
            });

        }

        // res not sent yet?

        //this.mark("superCt is", {isReqSent: this.superCt.isReqSent});
        //this.mark("frdReqPreProcess is", {frdReqPreProcess: this.superCt.frdReqPreProcess});

        if (!this.superCt.isReqSent(reqInfo.ctx)) {

            this.print.error("Request not finished by pg backend hub\n");

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-pg-bk-hub-sent-no-res")
            });

        }

    }

    async frdReqPreProcess(reqInfo: RequestInfo) {

        // sending the request into the backend hub
        try {

            await this.bkdHub.runA(
                "before-frontend-request", null, reqInfo
            );

        }
        catch(error) {

            /*this.print.error(
                "err-pg-backend-incoming-req-exception",
                error
            );*/

            await this.runA("send-response", {
                ctx: reqInfo.ctx,
                msg: Msg.error("err-pg-frontend-req-exception")
            });

        }

    }

}