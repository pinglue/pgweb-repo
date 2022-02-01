
import type {
    Message
} from "@pinglue/utils";

import {FrontendController} from "@pgweb/utils/browser";

import type {
    ControllerSettings
} from "pinglue/browser";

import type {
    RemoteChanCmdParams
} from "../commons";

//=========================================

interface Settings extends ControllerSettings {

    remoteChannels?: string[];
}

export class RemoteChanSct extends FrontendController {

    protected settings: Settings;

    async init() {

        // gluing for remote channels
        if (Array.isArray(
            this.settings.remoteChannels
        )) {

            this.log(
                "msg-initing-remote-channels",
                this.settings.remoteChannels
            );

            for (
                const channelName of this.settings.remoteChannels
            ) {

                try {
                // registering the proxy channel
                    this.regChannel(channelName, {
                        proxy: {
                            channelName,
                            hubId: "backend"
                        },
                        singleHandler: true,
                        reducer: "single-pass",
                        syncType: "async"
                    });

                    this.glue(
                        channelName,
                        async(params, value, meta) => this.handler({
                            channel: channelName,
                            controllerId: meta.runner,
                            runParams: params,
                            value
                        })
                    );                    
                }
                catch(error) {
                    this.log.error("err-reg-remote-chan-failed", {
                        channelName,
                        error
                    });
                }

            }

        }

    }

    async handler(params: RemoteChanCmdParams) {

        const res: Message = await this.send(
            "remote-chan",
            params
        );

        if (res.type !== "success") {

            this.log.error("err-remote-chan-run-failed", res);
            return;

        }
        else return res.data;

    }

}