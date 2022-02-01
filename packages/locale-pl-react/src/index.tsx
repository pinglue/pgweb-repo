
import React, {
    useState, useEffect, useRef, Children
} from "react";

import {usePin} from "@pgweb/react-utils";

export function LocText({children, params, id = ""}) {

    const [text, setText] = useState("");

    // the current text being processed - null means nothing - used for avoiding race conditions on text update
    const curKey = useRef(null);

    const {log, useGlue, runA} = usePin(
        `cmp-loc-text--${id || ""}`
    );

    let key;
    const firstChild = Children.toArray(children)?.[0];

    if (
        typeof firstChild === "string"
    ) {

        //log.mark("Key is ", {key});
        key = firstChild;

    }

    const update = async()=>{

        //log.mark("Running update");

        if (!key) {

            //log.mark("No key!");
            return;

        }

        curKey.current = key;

        const res = await runA("localize", {
            functionName: "t",
            key: key, params
        });

        // not found
        if (!res) {

            //log.mark("text not found!");
            return;

        }

        // another update took place while processing this text (race condition)
        if (curKey.current !== key)
            return;

        curKey.current = null;
        setText(res);

    };

    // initial load
    useEffect(()=>{

        update()
            .catch(()=>{});

    }, [key, params]);

    // locale change:
    useGlue("locale-changed", async()=>update());

    return (
        <span>{text}</span>
    );

}