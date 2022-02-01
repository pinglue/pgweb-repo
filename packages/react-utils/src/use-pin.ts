
import React, {
    useState,
    useEffect,
    useRef
} from "react";

import type {
    ControllerSettings,
    ChannelHandler,
    HubRegisterObject
} from "pinglue/browser";

import {Controller} from "pinglue/browser";

import type {
    PgModuleMessenger
} from "@pinglue/utils";

import {
    Msg,
    emptyPgModuleMessenger,
    messageTypes
} from "@pinglue/utils";

import {pgGlobalObject} from "@pgweb/utils/browser";

import {useFixValue} from "./use-fix-value.js";

import type {
    PinObject,
    UseGlueFunction
} from "./pin";

//================================================

export function usePin(
    id: string = "pin-ct",
    settings?: ControllerSettings
): PinObject {

    if (!pgGlobalObject.pgRegMemo)
        throw Msg.error("err-no-global-pg-reg-memo");

    const [ct, setCt] = useState<Controller>(
        ()=>createCt(
            pgGlobalObject.pgRegMemo((regObj)=>{

                setCt(createCt(regObj, id, settings));

            }), id, settings
        )
    );

    // cleaning up
    useEffect(()=>{

        return () => {

            if (ct) ct.cleanup();

        };

    }, []);

    const ctRef = useRef<Controller | null>();
    ctRef.current = ct;

    const useGlue = useFixValue<UseGlueFunction>(useGlueFactory, ctRef);

    if (ct) {

        //const ct = ctRef.current;
        return {

            isReady: true,

            log: bindPgModuleMessenger(ct, ct.log),

            report: bindPgModuleMessenger(ct, ct.report),

            runS: ct.runS.bind(ct),

            runA: ct.runA.bind(ct),

            useGlue
        };

    }
    else {

        return {
            isReady: false,
            log: emptyPgModuleMessenger,
            report: emptyPgModuleMessenger,
            runS: (channelName, params?, value?)=>{},
            runA: async(channelName, params?, value?, options?)=>{},
            useGlue
        };

    }

}

function useGlueFactory(
    ctRef: React.MutableRefObject<Controller | null>
): UseGlueFunction {

    return (
        channelName: string,
        handler: ChannelHandler
    ) => {

        const handlerRef = useRef<ChannelHandler>();
        handlerRef.current = handler;

        const isGlued = useRef(false);

        if (!isGlued.current) {

            if (!(ctRef.current instanceof Controller))
                return;

            const res = ctRef.current.glue(
                channelName,
                (params, values, meta) =>
                    handlerRef.current(params, values, meta)
            );

            if (res) isGlued.current = true;

        }

    };

}

/**
 * catches the error, and returns null
 */
function createCt(
    regObj: HubRegisterObject,
    id?: string,
    settings?: ControllerSettings
): Controller | null {

    if (!regObj) return null;

    try {

        const settings2: ControllerSettings = {
            ...settings,
            __flexId: true
        };
        const ct = regObj.registerNew(id, settings2);
        ct.initCallbackSync();
        ct.startCallbackSync();
        return ct;

    }
    catch(error) {

        // TODO: how to handle the error?
        return null;

    }

}

function bindPgModuleMessenger(
    ct: Controller,
    method: PgModuleMessenger
): PgModuleMessenger {

    return Object.assign(
        method.bind(ct),
        messageTypes.reduce((acc, type)=>{

            acc[type] = method[type].bind(ct);
            return acc;

        }, {})
    );

}