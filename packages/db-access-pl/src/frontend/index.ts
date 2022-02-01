
import type {
    Message
} from "@pinglue/utils";

import {
    Msg,
    _clone,
    _cloneFreeze,
    _freeze
} from "@pinglue/utils";

import {FrontendController} from "@pgweb/utils/browser";

import type {
    FindQueryParams,
    FindQuery,
    PaginationInfo
} from "../commons";

//=========================================================

export default class extends FrontendController {

    async init() {

        await super.init();

        this.glue(
            "db-query",
            this.queryHandler.bind(this)
        );

    }

    async queryHandler(
        params: FindQueryParams
    ): Promise<Message> {

        this.log("msg-db-query", params);

        // format validation
        if (!params.collection) {

            this.log.error("err-no-collection-given", {params});
            return Msg.error("err-no-collection-given");

        }

        const {collection, group} = params;

        let query: FindQuery = params.query ? _clone(params.query) : {};

        // step 1: query building
        await this.runA("db-query-build",
            {collection, group},
            query
        );

        let paginationInfo: PaginationInfo = (params.paginationInfo) ? _clone(params.paginationInfo) : {};

        const value: {
            query: FindQuery;
            paginationInfo: PaginationInfo;
            data?: Object | any[];
        } = {
            query,
            paginationInfo
        };

        // step 2: pre-processing
        await this.runA(
            "db-query-before-send",
            {collection, group},
            value
        );

        if (value.data)
            return Msg.success("", value.data);

        // freezing
        _freeze(query);
        _freeze(paginationInfo);

        const res = await this.send("find", {
            collection, group, query, paginationInfo
        });

        if (
            !res ||
            res.type !== "success"
        ) {

            this.log.error("err-failed-send", {res});
            return Msg.error("err-failed-send");

        }

        if (!res.data) {

            this.log.warn("warn-empty-server-response", {
                data: res.data
            });

        }

        await this.runA(
            "db-response-process",
            Object.freeze({
                collection, group, query, paginationInfo
            }),
            res.data
        );

        if (Array.isArray(res?.data?.result)) {

            res.data.result = await Promise.all(res.data.result.map(
                    item => this.runA(
                        "db-result-item-process",
                        Object.freeze({
                            collection, group, query, paginationInfo
                        }),
                        item
                    )
                )
            );
            
        }

        const data = _cloneFreeze(res.data);

        // no need to await
        this.runA("db-response", Object.freeze({
            collection,
            group,
            query,
            paginationInfo,
            data
        })).then(()=>{}).catch(()=>{});

        return Msg.success("", data);

    }

}
