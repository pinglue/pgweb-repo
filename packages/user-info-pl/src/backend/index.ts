
import type {
    RequestContext,
    BackendControllerSettings
} from "@pgweb/utils/node";

import {
    BackendController
} from "@pgweb/utils/node";

//=================================

type GetUserParams = {
    ctx: RequestContext;
    fields?: string[];
};

interface Settings extends BackendControllerSettings {
    fields?: string[];
}

export default class extends BackendController {

    protected settings: Settings;

    async init() {

        this.glue(
            "get-users-info",
            this.getUsersHandler.bind(this)
        );

    }

    async getUsersHandler(
        params: GetUserParams
    ): Promise<Object[]> {

        // TODO: security check

        const {ctx, fields} = params;

        // TODO: check the fields, default it and eliminate unathorized fields from it

        const projection = (fields || []).reduce(
            (acc, name)=>{

                acc[name] = 1;
                return acc;

            }, {}
        );

        const col = await this.getCollection("users", {
            exact: true
        });

        return col.find({}, {projection}).toArray();

    }

}
