
import {FrontendController} from "@pgweb/utils/browser";

import {
    ModalOptions,
    ModalOpenOptions,
    ModalCloseOptions
} from "./commons";

type ModalInfo = {
    id: string;
    options: ModalOptions;
};

export default class extends FrontendController {

    // TODO: come from settings
    baseZIndex = 100;

    stack: ModalInfo[] = [];

    async init() {

        await super.init();

        this.glue(
            "open-modal",
            this.openModalHandler.bind(this)
        );

        this.glue(
            "close-modal",
            this.closeModalHandler.bind(this)
        );

    }

    async openModalHandler(params: {
        id: string;
        options?: ModalOpenOptions;
    }) {

        //this.mark("Gonna open modal", params);

        const {id, options} = params;

        if (!id) {

            this.log.error("err-no-modal-id-found");
            return;

        }

        // opening the new modal
        const options2: ModalOptions = {
            ...options,
            zIndex: this.baseZIndex + this.stack.length
        };

        const options3: ModalOptions =
            await this.runA("modal", {
                id,
                open: true,
                options: options2
            });

        //this.mark("options 3 is", options3);

        // what to do with the previous modal?
        if (this.stack.length > 0) {

            const prevModalInfo =
                this.stack[this.stack.length - 1];

            switch(options3.prevStatus) {

                case "open":
                    break;

                default:
                    await this.runA("modal", {
                        id: prevModalInfo.id,
                        open: false
                    });

                // TODO: cases of blur and overlay

            }

        }

        // good, add the new modal to the stack
        this.stack.push({
            id,
            options: options3
        });

    }

    async closeModalHandler(params: {
        id: string;
        options?: ModalCloseOptions;
    }) {

        //this.mark("Gonna close modal", params);

        const {id, options} = params;

        if (!id) {

            this.log.error("err-no-modal-id-found");
            return;

        }

        // closing the modal

        // TODO: the closing modal should be the one on the top, otherwise we do nothing - but is it a good design?
        if (this.stack.length === 0) return;
        const modalInfo = this.stack[this.stack.length - 1];
        if (id !== modalInfo.id) return;

        // close the modal
        await this.runA("modal", {
            id,
            open: false,
            options
        });

        // remove from the stack
        this.stack.pop();

        // open the previous one
        if (this.stack.length > 0) {

            const info = this.stack[this.stack.length - 1];

            await this.runA("modal", {
                id: info.id,
                open: true,
                options: info.options
            });

        }

    }

}
