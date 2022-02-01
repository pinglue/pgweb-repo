
import React, {Children} from "react";

import type {
    Object,
    PgModuleMessenger
} from "@pinglue/utils";

import {PHASE} from "./phase.js";

import type {
    PinProps
} from "../pin";

import type {
    StatesObject
} from "./seed-states";

//========================================

export function buildSeedReactEl(
    props: PinProps,
    phaseRef: React.MutableRefObject<PHASE>,
    statesObject: StatesObject,
    onChange: Function,
    onSeedRendered: (node: Element) => void,
    log: PgModuleMessenger
) {

    log.mark("building react seed element");

    // error: no role, no honey
    if (
        phaseRef.current === PHASE.genesis &&
        !props.roles
    ) {

        log.warn("A pin without roles!", props);
        phaseRef.current = PHASE.error;
        return null;

    }

    // pin is not ready?
    if (phaseRef.current !== PHASE.started)
        return null;

    const pinChildren = Children.toArray(props.children);

    // checking that pin has exactly one seed
    if (pinChildren.length === 0) {

        log.error("err-pin-has-no-seed");
        phaseRef.current = PHASE.error;
        return null;

    }
    else if (pinChildren.length > 1) {

        log.error("err-pin-has-multiple-seeds");
        phaseRef.current = PHASE.error;
        return null;

    }

    // original seed element
    const orgSeed = pinChildren[0] as React.ReactElement;

    // is the seed element a base html element or a component?
    // TODO: this part might be different in React native ...
    const isBase = (
        typeof orgSeed.type === "string"
    );

    // no render status
    if (statesObject.status?.[0] === "no-render") {

        //log.mark("no render status - returning null");
        return null;

    }

    /* building props
    ---------------------*/

    const seedProps: Object = {};

    // adding props state
    if (
        statesObject.props?.[0] &&
        typeof statesObject.props[0] === "object"
    )  {

        Object.assign(seedProps, statesObject.props[0]);

    }

    // adding input state
    seedProps.value = statesObject.value?.[0] || "";

    /* old code based on using input prop instead of value
    if (isBase && _isBaseInput(orgSeed.type.toString())) {
        seedProps.value = statesObject.input?.[0] || "";
    }
    else if (
        !isBase &&
        typeof statesObject.input?.[0] !== "undefined"
    ) {

        // TODO: this part might be different in React native
        seedProps.input =
            statesObject.input[0];

    }*/

    // applying status prop for the values hidden & invisible
    switch(statesObject.status?.[0]) {

        case "hidden":
            seedProps.style = {display: "none"};
            break;

        case "invisible":
            seedProps.style = {visibility: "hidden"};
            break;

    }

    // adding callbacks
    seedProps.onChange = onChange;
    seedProps.ref = onSeedRendered;

    log.mark("prop built:", seedProps);

    /* rendering
    ----------------*/

    // TODO: apply status prop for disabled and busy

    // render with output state as a child
    if (
        _isPrimitiveData(statesObject.data?.[0]) &&
        isBase &&
        (!orgSeed.props.children ||
        _isPrimitiveData(orgSeed.props.children))
    )   {

        log.mark("rendering with output as a child");
        return (
            <orgSeed.type {...orgSeed.props} {...seedProps}>
                {statesObject.data[0]}
            </orgSeed.type>
        );

    }
    // render without children
    else {

        if (
            typeof statesObject.data?.[0] !== "undefined" &&
            !isBase
        )
            seedProps.data = statesObject.data[0];

        log.mark("rendering without children, props", seedProps);

        return (
            <orgSeed.type {...orgSeed.props} {...seedProps}>
                {orgSeed.props.children}
            </orgSeed.type>
        );

    }

}

/* Aux functions
==================== */

/*function _isBaseInput(type: string) {
    return [
        "input", "select", "textarea"
    ].includes(type);
}*/

function _isPrimitiveData(data: any) {

    return ["string", "number", "boolean"]
        .includes(typeof data);

}