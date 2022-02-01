
import type {
    ControllerSettings
} from "pinglue";

import type {
    Printer,
    Styler
} from "@pinglue/utils";

//================================

export interface Settings extends ControllerSettings {
    env: string;
    profiles: string;
    staticRoute: string;
    apiRoute: string;
    checkFrontend: boolean;
    watchFrontend: boolean;
    buildFrontend: boolean;
    watchBacktend: boolean;
    port: number;
    uploadDir: string;
    pgPath: string;
    silent: boolean;

    frontendLogger: "default-pg-print" | "console" | "none";
    backendLogger: "default-pg-print" | "console" | "none";

    fakeApiDelay?: number;

    frontend: {
        filePath?: string;
        url?: string;
        port?: number;
    };

    // for sub controllers and probably other modules
    _print?: Printer;
    _style?: Styler;
};
