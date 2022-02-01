
import type {Message} from "@pinglue/utils";

import {FrontendController} from "@pgweb/utils/browser";

import {Msg, _merge} from "@pinglue/utils";

type CacheEntry = {
    data: Object;
    timestamp: number;
};

export default class extends FrontendController {

    // internal cache
    // TODO: relaced by mor advanced, maybe using app-params channels, etc.
    cache = new Map<string, CacheEntry>();

    async init() {

        await super.init();

        this.glue(
            "get-form", this.getFormHandler.bind(this)
        );
        this.glue(
            "submit-form", this.submitFormHandler.bind(this)
        );

    }

    async getFormHandler(
        params: {id: string}
    ): Promise<Object> {

        const ans = this.cache.get(params.id);
        return ans?.data || {};

    }

    async submitFormHandler(
        params: {id: string; data: Object}
    ): Promise<Message> {

        const {id, data} = params;

        if (!id)
            return Msg.error("err-empty-form-id");

        if (!data || typeof data !== "object")
            return Msg.error("err-empty-data");

        // should submit the form?

        const shouldSubmitRes = await this.runA(
            "should-submit-form",
            {id, data}
        );

        if (
            shouldSubmitRes?.shouldSubmit === false
        ) {
            await this.runA(
                "form-submit-spam",
                {id, data}
            );
            return Msg.error("err-cannot-submit", shouldSubmitRes);
        }



        // cache
        // TODO: use app params
        this.cache.set(id, {
            data,
            timestamp: Date.now()
        });

        const res = await this.send("submit", params);

        this.report(_merge(res, {
            data: {id}
        }));

        return res;

    }

}
