
import React, {
    useRef,
    useCallback
} from "react";

import {RoleController} from "@pgweb/utils/browser";

import {PHASE} from "./phase.js";
import {logFactory} from "../log-factory.js";
import {useFixValue} from "../use-fix-value.js";
import {useCreateCts, useCleanupCts} from "./hooks-cts.js";
import {useSeedStates} from "./seed-states.js";
import {SeedElement} from "./seed-element.js";
import {buildSeedReactEl} from "./build-seed-react-el.jsx";

import type {
    PinProps,
    RolesImportInfo
} from "../pin";

//=====================================

// log for the factory
const RUNNER_ID = "Pin-cmp";
const log = logFactory(RUNNER_ID);

export function pinCmpFactory(
    importsInfo: Map<string, RolesImportInfo>
) {

    return (props: PinProps) => {

        // phase of the pin
        const phaseRef = useRef(PHASE.genesis);

        //log.mark(`pin body runs - phase: ${phaseRef.current}`);

        /* seed element
        -------------------------- */

        // state object
        const statesObject = useSeedStates();
        //log.mark("use seed state runs - obj:", statesObject);

        // uni ui element
        const seedElement = useFixValue<SeedElement>(
            ()=>new SeedElement()
        );

        // updating seed element state object
        //if (phaseRef.current === PHASE.started) {
        //log.mark("updating seed element stateobject");
        seedElement.statesObject = statesObject;
        //}

        // events update
        const onSeedRendered = useCallback(node => {

            //log.mark("seed element changed!", node);

            if (node === null ||
                phaseRef.current !== PHASE.started
            ) return;

            //log.mark("applying event listeners");

            seedElement.applyEventListeners(node);

        }, []);

        // input update
        const onChange = (
            event: React.ChangeEvent<HTMLInputElement>
        )=> statesObject.value[1](event.target.value);

        /* resident controllers
        -------------------------- */

        // set of resident controllers
        const ctSet = useRef<Set<RoleController>>();

        // creating
        useCreateCts(
            props,
            importsInfo,
            phaseRef,
            ctSet,
            seedElement,
            log
        );

        // cleaning up
        useCleanupCts(ctSet);

        /* rendering
        ------------------- */

        return buildSeedReactEl(
            props,
            phaseRef,
            statesObject,
            onChange,
            onSeedRendered,
            log
        );

    };

}
