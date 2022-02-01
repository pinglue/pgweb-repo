
import React, {useState, useEffect} from "react";

import {
    RoleController,
    pgGlobalObject
} from "@pgweb/utils/browser";

import type {
    PgModuleMessenger
} from "@pinglue/utils";

import type {
    HubRegisterObject
} from "pinglue/browser";

import {PHASE} from "./phase.js";
import {_registerResCts} from "./register-res-cts.js";
import {SeedElement} from "./seed-element.js";

import type {
    PinProps,
    RolesImportInfo
} from "../pin";

//==================================

export function useCreateCts(
    props: PinProps,
    importsInfo: Map<string, RolesImportInfo>,
    phaseRef: React.MutableRefObject<PHASE>,
    ctSet: React.MutableRefObject<Set<RoleController>>,
    seedElement: SeedElement,
    log: PgModuleMessenger
) {

    // reg object
    const [regObj, setRegObj] =
    useState<HubRegisterObject>(
        ()=>pgGlobalObject.pgRegMemo(val => {

            setRegObj(val);

        })
    );

    const [ready, setReady] = useState(false);

    useEffect(()=>{

        if (!regObj) return;

        log.mark("Building resident controllers");

        // weird, regobj changed second time!
        if (phaseRef.current !== PHASE.genesis) {

            this.log.warn(
                "warn-reg-obj-changed-post-genesis-phase"
            );
            return;

        }

        // initing controllers
        log("msg-registering-resident-cts");
        phaseRef.current = PHASE.initing;
        ctSet.current = _registerResCts(
            props,
            importsInfo,
            regObj,
            seedElement,
            log
        );

        if (ctSet.current.size === 0) {

            log.warn("warn-no-valid-role-found");
            phaseRef.current = PHASE.error;
            return;

        }

        // initing/starting resident controllers

        (async(): Promise<void>=>{

            log("msg-initing-resident-cts");

            await Promise.all([...ctSet.current].map(
                async ct=>ct.initCallback().catch(error=>{

                    log.error("err-ct-init-failed", ct);

                })
            ));

            log("msg-inited-resident-cts");

            // good, now start!

            phaseRef.current = PHASE.started;

            setReady(true);

            log.mark("starting cts now");

            await Promise.all([...ctSet.current].map(
                async ct=>ct.startCallback().catch(error=>{

                    log.error("err-ct-start-failed", ct);

                })
            ));

        })().catch(()=>{});

    }, [regObj]);

}

export function useCleanupCts(
    ctSet: React.MutableRefObject<Set<RoleController>>
) {

    useEffect(()=>{

        return ()=>{

            if (!ctSet.current) return;
            for(const ct of ctSet.current)
                ct.cleanup();

        };

    }, []);

}