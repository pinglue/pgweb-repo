
import type {
    RequestContext
} from "@pgweb/utils/node";

import {
    BackendController
} from "@pgweb/utils/node";

import type {
    RemoteChanCmdParams
} from "../commons";

//==================================

export class RemoteChanSct extends BackendController {

    async init() {

        this.cmdMap.set(
            "remote-chan",
            this.cmdRemoteChan.bind(this)
        );

    }

    async cmdRemoteChan(
        ctx: RequestContext,
        params: RemoteChanCmdParams
    ) {

        const {
            channel,
            controllerId,
            runParams,
            value
        } = params;

        this.log("msg-remote-channel-run", {channel});
        //this.mark("remote channel params", params);

        // validation
        if (
            !channel
        ) {

            this.log.error(
                "err-no-channel-name-provided",
                {channel}
            );

            await this.send.error(
                ctx,
                "err-no-channel-name-provided",
                {channel}
            );
            return;

        }

        const response = await this.runA(
            channel,
            {ctx, ...runParams},
            value
        );

        //this.mark("remote channel output", response);

        await this.send.success(ctx, "", response);

    }

}
