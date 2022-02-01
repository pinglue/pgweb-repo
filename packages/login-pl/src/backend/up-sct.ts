
import type {
    BackendSettings
} from "./types";

import type {
    RequestContext
} from "@pgweb/utils/node";

import {
    BackendController,
    Collection
} from "@pgweb/utils/node";

import type {
    UsernameType,
    LoginUpParams,
    LoginErrorResponse,
    LoginSuccessResponse
} from "../commons";

//=================================

type LoginUpDoc = {

    username: {
        [type in UsernameType]?: string
    };
    password: string;
    userId: any;

    registerDate?: number;
    lastLoginDate?: number;
};

export default class extends BackendController {

    settings: BackendSettings;

    async init() {

        this.cmdMap.set(
            "login-up", this.cmdLogin.bind(this)
        );

    }

    async cmdLogin(
        ctx: RequestContext,
        params: LoginUpParams
    ) {

        const {username, usernameType, password} = params;

        const col: Collection<LoginUpDoc> = await this.getCollection(
            "login-up",
            {exact: true}
        );

        const filter = {
            [`username.${usernameType}`]: username
        };

        const doc = await col.findOne(filter);

        // username not found
        if (!doc) {

            const response: LoginErrorResponse = {
                type: "error",
                code: "err-invalid-credentials",
                data: {
                    loginInfo: {
                        type: "up",
                        username,
                        usernameType
                    }
                }
            };

            await this.runA(
                this.internalChan("login"),
                {ctx, response}
            );

            return;

        }

        // verifying the password

        let isPwdVerified = false;

        const verChanRes = await this.runA("verify-hash", {
            hashingType: this.settings.pwdHashingType,
            text: password,
            hash: doc.password
        });



        if (typeof verChanRes?.isVerified === "boolean") {
            isPwdVerified = verChanRes.isVerified;
        }
        else {
            this.log.warn("warn-no-verify-hash-chan-response");
            isPwdVerified = doc.password === password;            ;
        }

        if (isPwdVerified) {

            const currentLoginDate = Date.now();
            const lastLoginDate = doc.lastLoginDate;

            await col.updateOne(filter, {$set:{
                lastLoginDate: currentLoginDate
            }
            });

            const response: LoginSuccessResponse = {
                type: "success",
                data: {
                    loginInfo: {
                        type: "up",
                        username,
                        usernameType,
                        registerDate: doc.registerDate,
                        currentLoginDate,
                        lastLoginDate
                    }
                }
            };

            //this.mark("user id is", {userId: doc.userId});

            await this.runA(
                this.internalChan("login"), {
                    ctx,
                    response,
                    userId: doc.userId?.toString()
                }
            );

        }
        // wrong password
        else {

            const response: LoginErrorResponse = {
                type: "error",
                code: "err-invalid-credentials",
                data: {
                    loginInfo: {
                        type: "up",
                        username,
                        usernameType
                    }
                }
            };

            await this.runA(
                this.internalChan("login"), {
                    ctx,
                    response
                }
            );

        }

    }

}
