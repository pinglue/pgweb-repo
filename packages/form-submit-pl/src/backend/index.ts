
import type {
    RequestContext
} from "@pgweb/utils/node";

import {BackendController} from "@pgweb/utils/node";

import type {Message} from "@pinglue/utils";

import {Msg} from "@pinglue/utils";

import {ObjectId} from "mongodb";

const SUBMISSION_COL_NAME = "submissions";

type GetSubmissionsParams = {
    id: string;
    ctx: RequestContext;
    skip?: number;
    limit?: number;
};

export default class extends BackendController {

    async init() {

        this.cmdMap.set(
            "submit", this.cmdSubmit.bind(this)
        );

        this.glue(
            "get-form-submissions",
            this.getSubmissionsHandler.bind(this)
        );

        this.glue(
            "remove-form-submission",
            this.removeSubmissionHandler.bind(this)
        );

    }

    async cmdSubmit(
        ctx, params: {id: string; data: Object}
    ) {

        const {id, data} = params;

        if (!id || !data)
            return this.send.error(
                ctx, "err-params-missing", params
            );

        try {

            const col =
                await this.getCollection(SUBMISSION_COL_NAME);

            await col.insertOne({
                formId: id,
                data,
                timestamp: Date.now()
            });
            return await this.send(ctx);

        }
        catch(error) {

            this.log.error("err-db-failed", error);
            return this.send.error(ctx, "err-db-failed");

        }

    }

    async getSubmissionsHandler(
        params: GetSubmissionsParams
    ): Promise<Object[]> {

        // TODO: security check!

        const {id, limit, skip} = params;

        if (!id)
            throw Msg.error("err-no-form-id-given");

        const col = await this.getCollection(SUBMISSION_COL_NAME);

        const res = await col.find(
            {formId: id},
            {
                projection: {formId:0},
                limit: limit || 50,
                skip: skip || 0,
                sort: {timestamp:-1}
            }
        ).toArray() || [];

        return res;

    }

    async removeSubmissionHandler(
        params: {id: string; ctx: RequestContext}
    ): Promise<Message> {

        // TODO: security checks!

        const {id} = params;

        if (!id) return Msg.error("err-no-id-given");

        const col =
            await this.getCollection(
                SUBMISSION_COL_NAME
            );

        const res = await col.deleteOne({_id:new ObjectId(id)});

        if (res.deletedCount)
            return Msg.success();
        else
            return Msg.error();

    }

}
