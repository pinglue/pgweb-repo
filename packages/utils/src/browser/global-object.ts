
import type {PgRegMemo} from "./memo-factory";

class PgGlobal {

    private map = new Map<string, any>();

    private _pgRegMemo: PgRegMemo;

    public get pgRegMemo() {

        return this._pgRegMemo || undefined;

    }

    public set pgRegMemo(val: PgRegMemo) {

        if (typeof this._pgRegMemo === "undefined")
            this._pgRegMemo = val;
        else
            throw new Error(
                "err-global-pg-reg-memo-reassigned"
            );

    }

    public set(key: string, value: any): void {

        this.map.set(key, value);

    }

    public get(key: string): any {

        return this.map.get(key);

    }

    public has(key: string): boolean {

        return this.map.has(key);

    }

}

export const pgGlobalObject = new PgGlobal();