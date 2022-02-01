
import {useRef} from "react";

export function useFixValue<T>(factory: Function, ...args): T {

    const ref = useRef(undefined);

    if (typeof ref.current === "undefined") {

        ref.current = factory(...args);
        return ref.current;

    }
    else
        return ref.current;

}