
import type {
    PgModuleMessenger,
    Message
} from "@pinglue/utils";

import {messageTypes} from "@pinglue/utils";

import {printLog} from "@pinglue/print/browser";

export function logFactory(runner: string): PgModuleMessenger {

    return Object.assign(
        (msg: Message) => {

            if (typeof msg === "object")
                printLog(msg, {runner});
            else
                printLog({type: "info", code:msg}, {runner});

        },
        (code: string, data?: any) => {

            if (typeof code === "string")
                printLog({type: "info", code, data}, {runner});
            else
                printLog(code, {runner});

        },
        messageTypes.reduce((acc, type)=>{

            acc[type] = (code: string, data?: any) => printLog({type, code, data}, {runner});
            return acc;

        }, {})
    );

}