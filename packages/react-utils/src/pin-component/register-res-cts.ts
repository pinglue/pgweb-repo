
import {RoleController} from "@pgweb/utils/browser";

import {SeedElement} from "./seed-element";

import type {
    PinProps,
    RolesImportInfo
} from "../pin";

import type {
    HubRegisterObject
} from "pinglue/browser";

import type {
    PgModuleMessenger
} from "@pinglue/utils";

//====================================

export function _registerResCts(
    props: PinProps,
    importsInfo: Map<string, RolesImportInfo>,
    regObj: HubRegisterObject,
    seedElement: SeedElement,
    log: PgModuleMessenger
): Set<RoleController> {

    const ans = new Set<RoleController>();

    for(const [key, args] of
        Object.entries(props.roles)) {

        const [controllerId, roleName] =
            _parseKey(key) || [null, null];

        // valid expression
        if (controllerId === null) {

            log.error("err-bad-role-expression", {
                expression: key
            });
            continue;

        }

        // is controller id valid?
        const importInfo = importsInfo.get(controllerId);

        if (!importInfo) {

            log.error("err-ct-id-not-found", {

                controllerId,
                expression: key
            });
            continue;

        }

        // role not found

        const RoleClass = importInfo.module?.[
            _toPascal(roleName)
        ];

        if (!RoleClass) {

            log.error("err-rolename-not-found", {
                roleName,
                controllerId,
                expression: key
            });
            continue;

        }

        // all good! register the controller
        const id = _getId(props, controllerId, roleName);
        const ct = regObj.registerNew(id,
            {
                ...importInfo.settings,
                __args: args,
                __flexId: true
            }, RoleClass
        ) as RoleController;

        ct.pin = seedElement;

        ans.add(ct);

    }

    return ans;

}

/**
 * returns [controllerId, roleName] - in case of error return null
 * @param key
 */
function _parseKey(
    key: string
): [string, string] | null {

    const m = key.match(/^([\w\-_]+)\/([\w\-_]+)$/);
    if (!m) return null;

    return [m[1], m[2]];

}

function _toPascal(str: string) {

    return str.split("-").map(term => {

        if (term.length === 0) return term;
        return term.charAt(0).toUpperCase() + term.slice(1);

    }).join("");

}

function _getId(
    props: PinProps,
    controllerId: string,
    roleName: string
) {

    return `cmp-${props.id || "generic"}/${controllerId}/${roleName}`;

}