
import EventEmitter from "events";

import {_default} from "@pinglue/utils";

import type {
    FactorySettings,
    GenCodeSettings,
    RegistryWatchEvent,
    RegistryWatchEventName,
    ImportInfo
} from "pinglue";

import {Factory, Registry} from "pinglue";

//=============================================

export interface PgFactoryCodeSettings extends FactorySettings {

    localLoggerType?: "none" | "console" | "default-pg-print";
    varPrefix?: string;
}

export class PgFactoryCodeGen extends EventEmitter {

    private factory: Factory;

    constructor(
        private settings: PgFactoryCodeSettings = {},
        route = "frontend"
    ) {

        super();

        this.factory = new Factory(route, settings);

        // proxying events to the factory
        Registry.WATCH_EVENT_NAMES.forEach((eventName) =>
            this.factory.on(eventName, (obj) =>
                this.emit(eventName, obj)
            )
        );

    }

    public on(
        eventName: RegistryWatchEventName,
        callback: (event: RegistryWatchEvent) => void
    ) {

        return super.on(eventName, callback);

    }

    public async init() {

        await this.factory.init();

    }

    /**
     * @throws
     */
    public getCode(settings: GenCodeSettings = {}): string {

        let localLoggerImports;
        if (this.settings.localLoggerType === "console")
            localLoggerImports = {
                name: "consoleMessenger",
                path: "@pinglue/utils"
            } as ImportInfo;

        else if (this.settings.localLoggerType === "default-pg-print")
            localLoggerImports = {
                name: "printLog",
                path: "@pinglue/print/browser"
            } as ImportInfo;

        const genCodeSets: GenCodeSettings = _default(settings, {
            localLoggerImports,
            hubPkgName: "pinglue/browser",
            varPrefix: this.settings.varPrefix,
            hubVarName: "hub"
        });

        //console.log("Hey, gen code settings", settings);

        const input: TemplateInput = {

            importsStr:
                this.factory.genCodeImports(genCodeSets).code,

            hubStr:
                this.factory.genCodeHubConstruction(genCodeSets).code,

            regsStr:
                this.factory.genCodeCtRegs(genCodeSets).code,

            initStr:
                this.factory.genCodeInitHub(genCodeSets),

            startStr:
                this.factory.genCodeStartHub(genCodeSets)

        };

        return genCode(input);

    }

}

type TemplateInput = {
    importsStr: string;
    hubStr: string;
    regsStr: string;
    initStr: string;
    startStr: string;
};

const genCode = (input: TemplateInput) => `

import {memoFactory, pgGlobalObject} from "@pgweb/utils/browser";

${input.importsStr}

async function factory() {

${input.hubStr}

${input.regsStr}

${input.initStr}

${input.startStr}

return hub.registerObject; 

}

pgGlobalObject.pgRegMemo =  memoFactory(factory);

`;
