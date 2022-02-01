
import {
    FrontendController, pgGlobalObject
} from "@pgweb/utils/browser";

export class StaticKeyLkSct extends FrontendController {

    protected settings: Settings;

    async init() {

        this.glue(
            `${this.id}/--lookup-key-local`,
            this.lookupKey.bind(this)
        );

    }

    lookupKey(
        {lang, domain, code}: LkKeyLocalParams
    ) {

        const ans = pgGlobalObject?.get(
            this.settings.globalObjField
        )?.[lang]?.[domain]?.[code];

        if (ans) return ans;

    }

}