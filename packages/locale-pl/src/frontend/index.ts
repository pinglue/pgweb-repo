
import {FrontendController} from "@pgweb/utils/browser";

// sub controllers
import {StaticKeyLkSct}
    from "./static-key-lookup-sct.js";
import {TranslateSct} from "./translate-sct.js";

export default class extends FrontendController {

    async init() {

        await this.newSubController(
            "static-key-lk", StaticKeyLkSct
        );

        await this.newSubController(
            "translate", TranslateSct
        );

    }

}
