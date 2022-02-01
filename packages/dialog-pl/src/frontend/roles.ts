
import {RoleController} from "@pgweb/utils/browser";
import {_merge, _default, Msg} from "@pinglue/utils";

import {
    ModalOptions
} from "./commons";

export class OpenModal extends RoleController {

    mid: string;
    options: ModalOptions;

    async init() {

        const {id, options} = _getModalInfo(this.args);
        this.mid = id;
        this.options = options;

        this.pin.addEventListener(
            "click", this.onClick.bind(this)
        );

    }

    async onClick() {

        this.mark("I'm clicked");

        await this.runA("open-modal", {
            id: this.mid,
            options: this.options
        });

    }

}

export class CloseModal extends RoleController {

    mid: string;
    options: ModalOptions;

    async init() {

        const {id, options} = _getModalInfo(this.args);
        this.mid = id;
        this.options = options;

        this.pin.addEventListener(
            "click", this.onClick.bind(this)
        );

    }

    async onClick() {

        await this.runA("close-modal", {
            id: this.mid,
            options: this.options
        });

    }

}

export class Modal extends RoleController {

    mid: string;
    options: ModalOptions;

    async init() {

        const {id, options} = _getModalInfo(this.args);
        this.mid = id;

        if (!this.mid) {

            this.log.error("err-modal-id-not-found", {
                args: this.args
            });
            return;

        }

        // defaulting options
        this.options = _default({}, options, {
            status: "normal",
            prevStatus: "close"
        });

        this.glue(
            "modal",
            this.handler.bind(this)
        );

        this.log("msg-modal-initiated", {id:this.mid});

    }

    async handler(params: {
        id: string;
        open?: boolean;
        options?: ModalOptions;
    }) {

        //this.mark("I'm called ", params);

        if (params.id !== this.mid) return;

        const options = _merge(
            {}, this.options, params.options
        );

        this.pin.setProps({
            open: params.open,
            options
        });

        return options;

    }

    /*async openHandler(params) {

        this.mark("Openning me", params);

        if (params?.id !== this.id) return;

        this.pin.setProps({open: true});
    }

    async closeHandler(params) {

        this.mark("Closing me", params);

        if (params?.id !== this.id) return;

        this.pin.setProps({open: false});
    }*/

}

/* aux functions */

/**
 *
 * @param args
 * @returns
 * @throws
 */
function _getModalInfo(args?: any) {

    if (!args) {

        throw Msg.error(
            "err-empty-args", {args}
        );

    }
    else if (typeof args === "object")
        return {
            id: String(args?.id),
            options: args?.options || {}
        };

    else
        return {
            id: String(args),
            options:{}
        };

}