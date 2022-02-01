
import { Collection, ObjectId } from "mongodb";

import type {
    ControllerSettings
} from "pinglue";

import {Controller} from "pinglue";

import type {
    Message,
    Object
} from "@pinglue/utils";

import type {
    RequestService
} from "../commons";

import type {
    RequestContext
}   from "./request";

//==============================================

export interface BackendControllerSettings extends ControllerSettings {
    __noApiReqHandling?: boolean;
}

// command handler
type CmdHandler = (
    ctx: RequestContext,
    params?: Object
) => Promise<void>;

type SendMethodTypes = "success" | "error";

type SendMethodRaw = {
    (
        ctx: RequestContext,
        msg?: Message
    ): Promise<void>;

    (
        ctx: RequestContext,
        code?: string,
        data?: Object
    ): Promise<void>;
};

type SendMethod = SendMethodRaw & {
    [type in SendMethodTypes]?: SendMethodRaw
};

/**
 * @class BackendController
 * A subclass of Controller featuring some extra methods to make life easier for backend operations, including:
 * - cmdMap: handling the frontend requests
 * - send (send.error/send.success) method
 * -
 */
export class BackendController extends Controller {

    protected settings: BackendControllerSettings;

    protected send: SendMethod;

    // to be filled by subclasses for easy command handling
    protected cmdMap = new Map<string, CmdHandler>();

    constructor(id, settings: BackendControllerSettings) {

        super(id, settings);

        /* initing the awesome send method
        ------------------------------------ */

        const sendRawFactory = type => async(
            ctx: RequestContext,
            msg?: string | Message,
            data?: Object
        ) => {

            // defaulting the type to the given type
            const msg2 = (typeof msg === "object") ? (msg || {}) : {
                type,
                code: msg,
                data
            };
            if (!msg2.type) msg2.type = type;

            await this.#send(ctx, msg2);

        };

        const baseSendMethod = sendRawFactory("success");
        const errorSendMethod = sendRawFactory("error");

        this.send = Object.assign(
            baseSendMethod,
            {
                success: baseSendMethod,
                error: errorSendMethod
            }
        );

        /* extra backend inits
        ---------------------------- */

        this.addInitMethod(async()=>this.backendInit());

    }

    async backendInit() {

        if (!this.settings.__noApiReqHandling) {

            this.glue(
                "process-api-req",
                this.#requestHandler.bind(this)
            );

        }

    }

    /**
     * Send method helper
     * @param ctx
     * @param msg
     * @returns
     */
    async #send(
        ctx: RequestContext,
        msg: Message
    ): Promise<void> {

        this.log("msg-sending-res", {
            type: msg.type,
            code: msg.code
        });

        return this.runA(
            "send-response",
            {ctx, msg}
        );

    }

    /**
     * handling channel @process-api-req - assumes that ctx is in the right format and res is not ended (validation is to be done at higher level, ususally with the runner-pl)
     * @param params
     */
    async #requestHandler({ctx, pgReq}: {
        ctx: RequestContext;
        pgReq: RequestService;
    }) {

        const {cmd, params} = pgReq;

        this.log("msg-processing-api-req", {cmd});

        const handler = this.cmdMap.get(cmd);
        await handler?.(ctx, params);

    }

    /* Helpers
    =========================== */

    // session helpers

    async getSession(
        ctx: RequestContext,
        key: string
    ): Promise<string | undefined> {

        return this.runA("get-session", {key, ctx});

    }

    async setSession(
        ctx: RequestContext,
        key: string,
        value?: string | null
    ): Promise<void> {

        await this.runA("set-session", {key, value, ctx});

    }

    async unsetSession(
        ctx: RequestContext,
        key: string
    ): Promise<void> {

        await this.setSession(ctx, key, undefined);

    }

    // DB helpers

    /**
     * Get the collection with the given name, running @get-mongodb-collection channel
     * @param name
     */
    async getCollection<T extends Object>(
        name: string,
        options?: {exact?: boolean}
    ): Promise<Collection<T>> {

        return this.runA(
            "get-mongodb-collection",
            {name, exact:options?.exact}
        ) as Promise<Collection<T>>;

    }

    // user/groups helpers

    async getUserId(
        ctx: RequestContext
    ): Promise<ObjectId> {

        return this.runA(
            "get-user-id", {ctx}
        ) as Promise<ObjectId>;

    }

    async checkMembership(
        ctx: RequestContext,
        expression = "member"
    ): Promise<boolean> {

        return this.runA(
            "validate-user-membership",
            {ctx, expression}
        );

    }

}