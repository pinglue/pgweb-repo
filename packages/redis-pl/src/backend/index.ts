
import redis from "redis";

import {BackendController} from "@pgweb/utils/node";


export default class extends BackendController {

    client;

    async init() {

        this.client = redis.createClient({
            url: this.settings.url
        });

        this.client.on("error", error => {

            this.log.error("err-redis-error", error);

        });

        this.log("msg-connection-redis");

        await this.client.connect();

        this.log.success("suc-redis-connected");

        // channels

        this.glue(
            "get-redis-client",
            this.getClientHandler.bind(this)
        );

    }

    async getClientHandler() {

        // TODO: security check

        return this.client;

    }

}
