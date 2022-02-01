
import React, {
    useState, useRef
} from "react";

import type {
    Message
} from "@pinglue/utils";

import * as immutable from "object-path-immutable";

type FormProps = {
    initData?: any;
    validatorObj: any;
    validatorObjType?: string;
};

type FieldPath = string | (string | number)[];

type RegOptions = {
    valueField?: string;
};

// key format: a.c.0.d
type ValidationError = Record<string, Message>;

type SubmitCallback = (data: any) => any;

type Updater = (former: any) => any;

type State = {
    data: any;
    error: ValidationError;
    isValid: boolean;
};

export function useForm(props: FormProps) {

    const valObjRef = useRef(props.validatorObj);

    const [state, setState] = useState<State>({
        data: props.initData || {},
        error: {},
        isValid: false
    });

    const onFieldChange = (fieldPath, value) => {

        //console.log(`Field "${fieldPath}" changed to "${value}"`);

        const newState = immutable.set(state, ["data", ...fieldPath], value);

        setState(newState);

    };

    const onSubmit = (cb: SubmitCallback) => {

        // validating - TODO: make it more generic and less dependent on yup

        valObjRef.current.validate(state.data,
            {recursive: true, abortEarly: false}
        )
            .then(()=>{

                setState({
                    ...state,
                    isValid: true,
                    error: {}
                });

                cb(state.data);

            })
            .catch(error => {

                setState({
                    ...state,
                    isValid: false,
                    error: getErrObjFromYup(error)
                });

            });

    };

    const reg = (
        fieldPath: FieldPath,
        options?: RegOptions
    ) => {

        const fieldPathN = normalizeFieldPath(fieldPath);

        return {
            onChange: event => onFieldChange(
                fieldPathN,
                event.currentTarget.value
            ),
            [options?.valueField || "value"]:
                immutable.get(state.data, fieldPathN) || ""
        };

    };

    const submit = (cb: SubmitCallback) => ({
        onClick: ()=>onSubmit(cb)
    });

    return {
        ...state, reg, submit,
        modify: modifyFactory(state, setState)
    };

}

/* aux function
====================== */

// normalize to array of indices, like ["a", "b", 12, "c"]
function normalizeFieldPath(
    p: FieldPath
): (string | number)[] {

    const p2: (string | number)[] = (typeof p === "string") ?
        p.split(".") : p;

    return p2.map(term => {

        // a number
        if (typeof term === "number")
            return term;

        term = String(term).trim();

        // a string number
        if (term.match(/\d+/))
            return Number(term);

        const m = term.match(/^\[(\d+)\]$/);

        // a string
        if (!m)
            return term;
        else
            return Number(m[1]);

    });

}

function getErrObjFromYup(yupErr) {

    if (!yupErr?.inner || !Array.isArray(yupErr.inner)) return {};

    return yupErr.inner.reduce(
        (acc, item)=>{

            const {path, params, type} = item;

            if (!path) return acc;

            const pathN: string = normalizeFieldPath(
                path
            ).join(".");

            const msg = {
                code: item.message,
                params,
                data: {type}
            };

            delete msg.params.path;
            delete msg.params.label;

            if (!acc[pathN]) {

                acc[pathN] = msg;
                return acc;

            }
            else if (Array.isArray(acc[pathN])) {

                acc[pathN].push(msg);
                return acc;

            }
            else {

                acc[pathN] = [acc[pathN], msg];
                return acc;

            }

        }, {}
    );

}

const modifyFactory = (state, setState) => ({

    set(p: FieldPath, value: any) {

        const newState = immutable.set(
            state,
            ["data", ...normalizeFieldPath(p)],
            value
        );
        setState(newState);

    },

    update(p: FieldPath, updater: Updater) {

        const newState = immutable.update(
            state,
            ["data", ...normalizeFieldPath(p)],
            updater
        );
        setState(newState);

    },

    push(p: FieldPath, value: any) {

        const newState = immutable.push(
            state,
            ["data", ...normalizeFieldPath(p)],
            value
        );
        setState(newState);

    },

    del(p: FieldPath) {

        const newState = immutable.del(
            state,
            ["data", ...normalizeFieldPath(p)]
        );
        setState(newState);

    },

    assign(p: FieldPath, obj: Object) {

        const newState = immutable.assign(
            state,
            ["data", ...normalizeFieldPath(p)],
            obj
        );
        setState(newState);

    },

    insert(p: FieldPath, obj: Object, position?: number) {

        const newState = immutable.insert(
            state,
            ["data", ...normalizeFieldPath(p)],
            obj,
            position
        );
        setState(newState);

    },

    merge(p: FieldPath, obj: Object) {

        const newState = immutable.merge(
            state,
            ["data", ...normalizeFieldPath(p)],
            obj
        );
        setState(newState);

    }

}
);
