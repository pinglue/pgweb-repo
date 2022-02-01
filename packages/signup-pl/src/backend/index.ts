
import {BackendController} from "@pgweb/utils/node";

import SignupUpSct from "./signup-up-sct.js";

export default class extends BackendController {

    async init() {

        // this.glue("channel-name", handler.bind(this))

        await this.newSubController(
            "signup-up-sct",
            SignupUpSct
        );

    }    
}
