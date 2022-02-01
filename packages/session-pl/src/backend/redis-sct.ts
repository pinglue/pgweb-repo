
import {BackendController} from "@pgweb/utils/node";

import type {
    Message
} from "@pinglue/utils";

import {Msg} from "@pinglue/utils";

import type {
    Settings
} from "./settings";

//==============================

export default class extends BackendController {

    protected settings: Settings;

    async init() {

        if (this.settings.store === "redis") {

            this.glue(
                this.internalChan("get-key"),
                this.getKeyHandler.bind(this)
            );

            this.glue(
                this.internalChan("set-key"),
                this.setKeyHandler.bind(this)
            );

            this.glue(
                this.internalChan("add-session"),
                this.addSessionHandler.bind(this)
            );

        }

    }

    /**
     * @throws
     */
    async getRedisClient() {

        const client = await this.runA(
            "get-redis-client"
        );

        if (!client)
            throw Msg.error("err-redis-client-not-available");

        else
            return client;

    }

    async getKeyHandler(
        {sid, key}: {sid: string; key: string}
    ) {

        const client = await this.getRedisClient();
        const hkey = this.getKey(sid);

        const ans = await client.hGet(hkey, key);

        return ans;

    }

    async setKeyHandler(
        {sid, key, value}: {
            sid: string; key: string; value: string | null;
        }
    ): Promise<Message> {

        const client = await this.getRedisClient();
        const hkey = this.getKey(sid);

        // deleting
        if (
            value === null ||
            typeof value === "undefined"
        )   await client.hDel(hkey, key);

        // adding/updating
        else
            await client.hSet(hkey, key, String(value));

        return Msg.success();

    }

    async existsSessionHandler(
        {sid}: {sid: string}
    ): Promise<boolean> {

        const client = await this.getRedisClient();
        const hkey = this.getKey(sid);

        const res = await client.hGet(hkey, "pg");

        return !!res;

    }

    async addSessionHandler(
        {sid}: {sid: string}
    ): Promise<boolean> {

        const client = await this.getRedisClient();
        const hkey = this.getKey(sid);

        const res = await client.hSetNX(hkey, "pg", "1");

        if (!res) return false;

        // redis key remain 1 more hour in the db more than its corresponding cookie, to ensure no session hijacking
        if (
            this.settings.sessionMaxAge &&
            typeof this.settings.sessionMaxAge === "number"
        )
            await client.expire(
                hkey, this.settings.sessionMaxAge + 3600
            );

        return true;

    }

    getKey(sid: string) {

        if (this.settings.storeKeyPrefix)
            return `${this.settings.storeKeyPrefix}::${sid}`;
        else
            return sid;

    }

}