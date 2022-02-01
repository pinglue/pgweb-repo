
import {RoleController} from "@pgweb/utils/browser";

export class Logout extends RoleController {

    async init() {

        this.pin.addEventListener(
            "click", this.onClick.bind(this)
        );

    }

    async onClick() {

        return this.runA("logout");

    }

}

export class ShowOnLogout extends RoleController {

    async init() {

        this.pin.status = "no-render";

        this.glue(
            "logged-in",
            this.loginHandler.bind(this)
        );

        this.glue(
            "logged-out",
            this.logoutHandler.bind(this)
        );

    }

    async start() {

        const res = this.runS("is-logged-in");
        this.pin.status = res.loggedIn ? "no-render" : "shown";

    }

    async loginHandler() {

        this.pin.status = "no-render";

    }

    async logoutHandler() {

        this.pin.status = "shown";

    }

}

export class ShowOnLogin extends RoleController {

    async init() {

        this.pin.status = "no-render";

        this.glue(
            "logged-in",
            this.loginHandler.bind(this)
        );

        this.glue(
            "logged-out",
            this.logoutHandler.bind(this)
        );

    }

    async start() {

        const res = this.runS("is-logged-in");
        this.pin.status = res.loggedIn ? "shown" : "no-render";

    }

    async loginHandler() {

        this.pin.status = "shown";

    }

    async logoutHandler() {

        this.pin.status = "no-render";

    }

}