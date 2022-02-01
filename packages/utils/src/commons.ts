
import type {
    FactorySettings
} from "pinglue";

/* Essentials
============================ */

// the format of the request payload the pg frontend sends to the backend
export type RequestService = {
    cmd: string;
    params?: Object;
};

// TODO
//type FilesInfo = any;
