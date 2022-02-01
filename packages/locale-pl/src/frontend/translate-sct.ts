
import {FrontendController} from "@pgweb/utils/browser";
//import {_default} from "@pinglue/utils";

export class TranslateSct extends FrontendController {

    protected settings: Settings;

    /**
     * language, two letter ISO name, en, ch, etc.
     */
    lang: string;

    async init() {

        // TODO: get it from global object
        this.lang = this.settings.defaultLang;

        this.glue("localize",
            this.localizeHandler.bind(this));

    }

    async localizeHandler(
        params: LocChanParams
    ): Promise<string> {

        if (params.functionName !== "t") return;

        return this.compilerHelper(
            String(params.key),
            params.params
        );

    }

    /**
     * compiles the expression t(key, params) and returns its value - to be used for the localize channel
     * @param code
     * @param params
     * @returns
     */
    async compilerHelper(
        key: string,
        params?: Object
    ): Promise<string> {

        if (!key) {

            return "";

        }

        // breaking the code into namespace and key name (format: ns::keyname)
        let domain = this.settings.defaultDomain;
        let code = key.trim();
        const m = key.match(/^([\w\-]+)\s*::/);

        if (m) {

            domain = m[1];
            code = key.slice(m[0].length).trim();

        }

        const lkChanParams: LkKeyLocalParams = {
            domain, code, lang:this.lang
        };

        const tStr = await this.runA(
            `${this.id}/--lookup-key-local`,
            lkChanParams
        ); /*TODO: remote fetching ||
        await this.runA(
            `${this.id}/--lookup-key-remote`,
            params2
        );*/

        if (tStr)
            return renderTemplate(tStr, params);

        else {

            this.log.warn("warn-unknown-key", {key: `${domain}::${code}`});
            return "";

        }

    }

}

/* Aux functions
========================== */

function renderTemplate(
    tStr: string,
    params: Object = {}
) {

    return tStr.replace(/\[\[([^}]+)\]\]/g, match => {

        let name = match.slice(2, -2).trim();
        return params[name] || "";

    });

}