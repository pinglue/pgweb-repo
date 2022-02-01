
import fs from "fs-extra";
import path from "path";
import csv2json from "csvtojson";
import chokidar from "chokidar";

import type {
    ControllerSettings
} from "pinglue";

import {Controller} from "pinglue";

import type {
    Printer,
    Styler
} from "@pinglue/utils";

import {_merge} from "@pinglue/utils";

const DIC_DIR = "dictionaries";
const FACTORY_FILENAME = "static-dc.js";

type StaticDcData = {
    [lang: string]: {
        [domain: string]: {
            [code: string]: string;
        };
    };
};

interface ServerSettings extends ControllerSettings {
    env: string;
    apiRoute: string;
    checkFrontend: boolean;
    watchFrontend: boolean;
    buildFrontend: boolean;
    watchBacktend: boolean;
    port: number;
    pgPath: string;
    silent: boolean;

    frontendLogger: "default-pg-print" | "console" | "none";
    backendLogger: "default-pg-print" | "console" | "none";

    frontend: {
        filePath?: string;
        url?: string;
        port?: number;
    };

    // for sub controllers and probably other modules
    _print?: Printer;
    _style?: Styler;
}

export default class extends Controller {

    protected settings: Settings;

    print: Printer;
    style: Styler;

    dcDirPath: string;
    factoryCodePath: string;
    isStaticDcValid = false;
    isWatching = false;

    async init() {

        this.dcDirPath = path.join(
            this.dataPath, DIC_DIR
        );

        // gluings
        this.glue("before-server-starts",
            this.beforeServerHandler.bind(this));
        this.glue("before-frontend-request",
            this.beforeFrdReqHandler.bind(this));

    }

    async beforeServerHandler() {

        const serverSettings: ServerSettings =
            this.runS("get-server-settings");

        this.print = serverSettings._print;
        this.style = serverSettings._style;
        this.factoryCodePath = path.join(
            serverSettings.pgPath,
            FACTORY_FILENAME
        );

        this.isWatching = !!serverSettings.watchFrontend;

        if (this.isWatching) {

            this.addWatcher();

        }

        if (serverSettings.buildFrontend) {

            this.print.info(`Static dictionary will be written to ${this.style.hl(this.factoryCodePath)}\n`);
            await this.writeFactoryCode();
            this.print("\n\n");

        }
        else this.isStaticDcValid = true;

    }

    addWatcher() {

        this.print.mute(`Watching the dictionary folder at ${this.dcDirPath}\n`);
        chokidar.watch(this.dcDirPath)
            .on("change", this.onDcsChanges.bind(this));

    }

    async onDcsChanges(filePath: string) {

        this.print.mute(`Dictionary files update detected at the file: "${filePath || "NA"}"\n`);

        this.isStaticDcValid = false;

    }

    async beforeFrdReqHandler() {

        // no need to update
        if (
            !this.isWatching ||
            this.isStaticDcValid
        ) return;

        this.print.mute("Update is needed for the static dictionaries - updating ...\n");

        await this.writeFactoryCode();

        this.print.success("Static dictionaries updated!\n\n");

        // wait a bit for the frontend web builder to update
        await new Promise<void>((resolve)=>
            setTimeout(()=>resolve(), 100)
        );

    }

    async writeFactoryCode() {

        this.print(`\nWriting static dictionary at "${this.factoryCodePath}" ... \n`);

        try {

            // TODO: change language or do it for all languages
            const dcObj = await this.getStaticDcJson("en");
            const code = codeTemplate(
                this.settings.globalObjField,
                dcObj
            );

            await fs.ensureFile(this.factoryCodePath);
            await fs.writeFile(
                this.factoryCodePath,
                code
            );

        }
        catch(error) {

            this.print.error("Failed!", error);
            this.isStaticDcValid = false;
            return;

        }

        this.isStaticDcValid = true;
        this.print.success("Done!\n");

    }

    // format: domain -> code -> val
    async getStaticDcJson(lang = "en"): Promise<StaticDcData> {

        const ans: StaticDcData = {[lang]: {}};

        const fileList = await fs.readdir(
            this.dcDirPath
        );

        for(const f of fileList) {

            try {

                if (f.startsWith(".")) continue;

                this.print.mute(`Parsing dictionary ${f} ... `);

                const csvData = await csv2json().fromFile(
                    path.join(
                        this.dcDirPath, f
                    )
                );

                let domain = f;
                const x = f.lastIndexOf(".");
                if (x !== -1) domain = f.slice(0, x);

                ans[lang][domain] = csvData.reduce(
                    (acc, row) => {

                        if (row[lang])
                            acc[row.code] = row[lang];

                        return acc;

                    }, {}
                );

                this.print.success("Done!\n");

            }
            catch(error) {

                this.log.error(`Failed parsing dictionary: ${f}\n`);

            }

        }

        return ans;

    }

}

/* Aux functions
================================= */

const codeTemplate = (dcGlobalField: string, dcData: StaticDcData) => `

import {pgGlobalObject} from "@pgweb/utils/browser";

pgGlobalObject?.set(
    "${dcGlobalField}",
    ${JSON.stringify(dcData)}
);

`;