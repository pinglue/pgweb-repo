
import {useState} from "react";

import type {
    UniUiStatus
} from "pinglue/browser";

//==================================

export type SeedState = "status" | "value" | "data" | "props";

type SetState<T> = (val: T) => void;

export type StatesObject = {
    status?: [UniUiStatus, SetState<UniUiStatus>];
    value?: [any, SetState<any>];
    data?: [any, SetState<any>];
    props?: [Object, SetState<Object>];
};

export function useSeedStates(): StatesObject {

    const obj: StatesObject = {};

    obj.status = useState<UniUiStatus>("shown");

    obj.value = useState(undefined);

    obj.data = useState(undefined);

    obj.props = useState<Object>(undefined);

    return obj;

}
