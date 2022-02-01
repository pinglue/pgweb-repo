
import {Controller} from "pinglue/browser";
import {Msg} from "@pinglue/utils";

import type {
    ControllerSettings,
    UniUiElement
}   from "pinglue/browser";

//===========================================

export interface RoleControllerSettings extends ControllerSettings {

    __args: Object;

}

export class RoleController extends Controller {

    protected settings: RoleControllerSettings;
    protected args: any;

    #pin: UniUiElement;

    constructor(
        id?: string,
        settings?: RoleControllerSettings
    ) {

        super(id, settings);

        // args init and freeze
        this.args = this.settings.__args;

    }

    set pin(pinObj: UniUiElement) {

        if (this.#pin) {

            this.log.error("err-re-assigning-pin");
            throw Msg.error("err-re-assigning-pin");

        }

        this.#pin = pinObj;

    }

    get pin(): UniUiElement {

        return this.#pin;

    }

}