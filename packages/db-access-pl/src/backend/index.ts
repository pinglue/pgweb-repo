
import type {
    RequestContext
} from "@pgweb/utils/node";

import {BackendController} from "@pgweb/utils/node";

import type {
    FindQueryParams,
    FindQueryResponse
} from "../commons";

import { ObjectId } from "mongodb";

export default class extends BackendController {

    async init() {

        await super.init();

        this.cmdMap
            .set("find", this.cmdFind.bind(this));

    }

    async cmdFind(
        ctx: RequestContext, params: FindQueryParams
    ) {

        const {collection, query} = params;

        const col = await this.getCollection(
            collection, {exact: true}
        );

        if (!col) {

            this.log.error(
                "err-db-collection-not-available", {collection}
            );

            await this.send.error(
                ctx, "err-db-collection-not-available"
            );

            return;

        }

        // TODO: run before-find-query channel on query to add security stuff

        let response: Partial<FindQueryResponse> = {};

        if (query.one) {

            response.result = await col.findOne(query.filters, {
                projection: query.projection
            }
            );

        }
        else {

            const cur = col.find(
                query.filters, {
                    projection: query.projection,
                    sort: query.sort
                });

            if (!query.noTotalCount) {

                response.totalCount = await cur.count();

            }

            if (query.skip)
                cur.skip(query.skip);

            response.result =
                await cur.limit(query.limit || 50).toArray();

        }

        _convertIds(response.result);

        await this.send(ctx, {data:response});

    }

}

function _convertIds(response: [] | Object) {

    if (Array.isArray(response)) {
        for (const item of response)
            _convertIds(item);        
    }
    else {
        for(const [k,v] of Object.entries(response)) {
            // TODO: why instanceof object id does not work?
            /*if (v instanceof ObjectId)
                response[k] = v.toString();*/
            if (k==="_id")
                response[k] = v.toString();
        }
    }
}