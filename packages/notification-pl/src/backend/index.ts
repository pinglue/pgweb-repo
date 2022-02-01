
import type {Object} from "@pinglue/utils";

import {BackendController, BackendControllerSettings, RequestContext} from "@pgweb/utils/node";

export interface Notification {

    type: "email" | "sms";

    // email address or phone number
    to: string;

    // for email only
    subjectTemplate?: {
        text?: string;
        // path will be appended by locale similar to the main body (see below for details)
        path?: string;        
    }

    // defaults to html for email type and text for phone type
    contentType?: "text" | "html";


    // the template eitehr comes from a direct text or from a path (relative to this.dataPath, normally at projectRoot/data/@pgweb/notification-pl) - the template will be filled with template.data - note the template will be rendered using the channel @render-template - so the template rules will be based on whatever plugin that handles this channel
    template?: {

        // for @render-template channel handler use
        type?: string; 

        // either the path or text should be provided - text will have precedence over path

        // note that the actual path will be have locale appended if it exists: e.g., signup/welcome.hb -> signup/welcome-en-US.hb (locale is obtained through channel @get-locale, supposedly handled by locale-pl)
        path?: string;

        text?: string;

        // optional data to be applied to the template
        data?: Object;
    }

    // additional options
    options?: Object;
}

export type SNParams = {
    ctx: RequestContext;
    notification: Notification;
}

export interface Settings extends BackendControllerSettings {
    isDummy?: boolean;
    email: {
        maxAttempts: number;
        fromAddress: string;
        smtpConfig?: {
            host: string;
            port?: number;
            username?: string;
            password?: string;
            secure?: boolean;
        }
    }
}

export default class extends BackendController {

    protected settings:Settings;

    async init() {

        this.glue(
            "send-notification", 
            this.sendDummyHandler.bind(this)
        );

    }

    async sendDummyHandler(
        params: SNParams
    ) {
        if (!this.settings.isDummy) return;
        this.mark("Dummy sending a notification", params);
    }
}
