
import fs from "fs-extra";
import path from "path";

import type {
    RegistryWatchEvent
} from "pinglue";

import {Controller, Factory} from "pinglue";

import type {
    Printer,
    Styler
} from "@pinglue/utils";

const ROLES_ROUTE = "frontend/roles";
const CODE_FILENAME = "pin.js";

export default class extends Controller {

    //protected settings: Settings;
    private print: Printer;
    private style: Styler;
    private factory: Factory;
    private factoryCodePath: string;

    // watch tools
    private isCodeValid = false;

    // callback binding
    beforeServerHandler__bound =
    this.beforeServerHandler.bind(this);
    onFrdSettingsChanged__bound =
    this.onFrdSettingsChanged.bind(this);
    beforeFrdReqHandler__bound =
    this.beforeFrdReqHandler.bind(this);

    async init() {

        // gluings
        this.glue("before-server-starts",
            this.beforeServerHandler__bound);
        this.glue("before-frontend-request",
            this.beforeFrdReqHandler__bound);

    }

    async beforeServerHandler() {

        this.settings = this.runS("get-server-settings");

        this.print = this.settings._print;
        this.style = this.settings._style;

        this.factoryCodePath = path.join(
            this.settings.pgPath,
            CODE_FILENAME
        );

        // initing code factory
        if (this.settings.buildFrontend) {

            // building factory
            this.print.header("\nIniting the react code factory ... \n");

            try {

                this.factory = new Factory(ROLES_ROUTE, {
                    env: this.settings.env,
                    print: this.print,
                    style: this.style,
                    watchSettings: this.settings.watchBacktend,
                    watchSource: this.settings.watchBacktend,
                    noImport: true
                });

                await this.factory.init();

            }
            catch(error) {

                this.print.error("Building react code factory failed!", error);
                throw error;

            }
            this.print.success("React code factory built!\n\n");

        }

        // watching code factory
        if (this.settings.watchFrontend &&
            this.factory) {

            this.factory.on(
                "change-settings",
                this.onFrdSettingsChanged__bound
            );

            this.print.info("Watching for the frontend/roles changes.\n\n");

        }

        // code factory initial writing
        if (this.settings.buildFrontend) {

            this.print.info(`React code factory will be written to ${this.style.hl(this.factoryCodePath)}\n`);
            await this.writeFactoryCode();
            this.print("\n\n");

        }

    }

    /**
     *
     * @param event
     */
    private onFrdSettingsChanged(event: RegistryWatchEvent) {

        this.print.mute(`Frontend/roles settings update detected at the file: "${event.filePath || "NA"}"\n`);

        this.isCodeValid = false;

    }

    /**
     * @throws
     */
    private async writeFactoryCode() {

        const code = this.genCode();

        this.print(`\nWriting react code factory at "${this.factoryCodePath}" ... `);

        try {

            await fs.ensureFile(this.factoryCodePath);
            await fs.writeFile(
                this.factoryCodePath,
                code
            );

        }
        catch(error) {

            this.print.error("Failed!", error);
            return;

        }

        this.isCodeValid = true;
        this.print.success("Done!\n");

    }

    async beforeFrdReqHandler() {

        // frontend is already updated
        if (
            !this.settings.watchFrontend ||
            this.isCodeValid
        ) return;

        this.print.mute("Update needed for the frontend/roles - updating ...\n");

        try {

            await this.factory.init();
            await this.writeFactoryCode();
            this.print.success("Frontend/roles updated!\n\n");

            // wait a bit for the frontend web builder to update
            await new Promise<void>((resolve)=>
                setTimeout(()=>resolve(), 100)
            );

        }
        catch(error) {

            this.print.error("Frontend/roles update failed!", error);

        }

    }

    /**
     *
     * @returns
     */
    genCode(): string {

        const imports: string[] = [];
        const mapSets: string[] = [];
        let counter = 1;

        for(
            const [pkgName, record] of
            this.factory.getPackages()
        ) {

            if (
                pkgName === "pinglue" ||
                record.loadError
            ) continue;

            imports.push(
                `import * as module${counter} from "${record.importPath}";`
            );

            const infoStr = `{
                module: module${counter++},
                settings: ${JSON.stringify(record.settings || {})}
            }`;

            mapSets.push(
                `.set("${record.info.id}", ${infoStr})`
            );

        }

        return _codeTemplate(
            imports.join("\n"),
            mapSets.join("\n")
        );

    }

}

/**
 * Code template
 * @param importsStr
 * @param mapSetsStr
 * @returns
 */
const _codeTemplate = (importsStr, mapSetsStr): string => `

import {pinCmpFactory} from "@pgweb/react-utils";

${importsStr}

const importsInfo = new Map()
${mapSetsStr};

export const Pin = pinCmpFactory(importsInfo);

`;