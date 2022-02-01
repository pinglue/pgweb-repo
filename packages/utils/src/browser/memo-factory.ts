
import type {
    HubRegisterObject
} from "pinglue/browser";

export type PgRegFactory = () => Promise<HubRegisterObject>;

type PgRegMemoCallback = (regObj: HubRegisterObject) => void;

export type PgRegMemo =
    (cb: PgRegMemoCallback) => HubRegisterObject | null;

export function memoFactory(factory: PgRegFactory): PgRegMemo {

    let obj = null;

    const cbSet = new Set<PgRegMemoCallback>();

    factory()
        .then(newObj=>{

            obj = newObj;
            for(const cb of cbSet)
                cb(obj);

            cbSet.clear();

        })
        .catch(() => {}); // TODO: how to handle thsi error?

    return (cb: PgRegMemoCallback) => {

        if (obj) return obj;
        else {

            cbSet.add(cb);
            return null;

        };

    };

}