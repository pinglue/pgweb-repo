
import {Controller} from "pinglue";

export default class extends Controller {

    async init() {

        this.glue(
            "before-server-starts",
            this.beforeServerHandler.bind(this)
        );

    }

    async beforeServerHandler() {

        const settings = this.runS("get-server-settings");

        const print = settings._print;

        print("\nCreating login collection indices ... \n");

        try {

            const col = await this.runA("get-mongodb-collection", {
                name: "login-up",
                exact: true
            });

            await col.createIndex({"username.email":1});
            await col.createIndex({"username.phone":1});

            print.success("Login collection indices Created!\n");

        }
        catch(error) {

            print.error("Creating login collection indices Failed!", error);
            return;

        }

    }

}