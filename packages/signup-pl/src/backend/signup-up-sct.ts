
import {BackendController, ObjectId} from "@pgweb/utils/node";
import { Msg } from "@pinglue/utils";

import type {
     
    SignupUpParams,    
    SignupInfo,
    SignupResponse,
    SignupErrorResponse,
    SignupSuccessResponse,

    RecoveryUpParams,    
    RecoveryInfo,
    RecoveryResponse,
    RecoveryErrorResponse,
    RecoverySuccessResponse,

    BackendSettings,
} from "./types";

export default class extends BackendController {

    protected settings:BackendSettings;

    async init() {

        this.glue(
            "signup-up", 
            this.signupHandler.bind(this)
        );

        this.glue(
            "recovery-up", 
            this.recoveryHandler.bind(this)
        );

    }

    async signupHandler(
        params: SignupUpParams
    ):Promise<SignupResponse> {

        const {
            ctx,
            username,
            usernameType,
            password,
            userInfo
        } = params;

        const signupInfo:SignupInfo = {
            type: "up",
            username, usernameType
        }
        
        // username already taken?
        if (
            await this.#getUserId(
                username, usernameType
            )
        ) {         
            return {
                type: "error",
                code: "err-username-taken",
                params: {
                    username
                },
                data: {signupInfo}
            } as SignupErrorResponse;

        }

        // username verification
        if (
            this.settings.verificationRequire &&
            ["email", "phone"].includes(usernameType)
        ) {

            const res = await this.runA(
                "is-user-verified",
                {
                    ctx,
                    type: usernameType,
                    value: username
                }
            );

            if (!res) {
                this.log.warn("warn-no-verification-response", {
                    type: usernameType,
                    value: username,
                    response: res
                });
                return Msg.error(
                    "err-internal", {signupInfo}
                ) as SignupErrorResponse;
            }

            if (!res.verified) {
                this.log.security(
                    "sec-signup-without-verification",
                    {
                        type: usernameType,
                        value: username,
                        response: res
                    }
                );
                return Msg.error(
                    "err-internal", {signupInfo}
                ) as SignupErrorResponse;
            }
        }

        // all good, do the signup now

        signupInfo.registerDate = Date.now();

        this.log.info("msg-signingup-user-up", {
            signupInfo
        });

        // inserting the new user info
        let userCol = await this.getCollection(
            "users", {exact: true}
        );
        let userId:ObjectId;
        try {

            const res = await userCol.insertOne(
                {...userInfo} || {}
            );
            userId = res.insertedId;
            this.log.success("suc-new-user-entry-created", {
                userId
            });

        } catch(error) {
            
            this.log.error(
                "err-user-doc-insertion-failed",
                {error, signupInfo}
            );
            return Msg.error(
                "err-internal"
            ) as SignupErrorResponse;
        }

        // generating password hash
        let {hash: pwdHash}:{hash: string} = 
            await this.runA(
                "generate-hash", {
                    hashingType: this.settings.pwdHashingType,
                    text: password,
                }
            ) || {};
        // generate-hash channel not handled
        if (!pwdHash) {
            this.log.warn("warn-no-generate-hash-chan-response", {
                hashingType: this.settings.pwdHashingType
            });
            // raw hashing
            pwdHash = password;
        }

        // insering the login-up collection record

        const loginCol = await this.getCollection(
            "login-up",
            {exact: true}
        );

        try {
            const res = await loginCol.insertOne({
                username: {
                    [usernameType]: username
                },
                registerDate: signupInfo.registerDate,
                password: pwdHash,
                userId
            });

            this.log.success(
                "suc-new-login-up-entry-created",
                {id: res.insertedId}
            );

        } catch(error) {

            this.log.error(
                "err-login-doc-insertion-failed",
                {error, signupInfo}
            );

            // cleaning up the user entry
            try {
                await userCol.deleteOne({_id: userId});
            }
            catch(error) {
                // TODO: handle this error
            }

            return Msg.error(
                "err-internal", {}
            ) as SignupErrorResponse;
            
        }

        return Msg.success(
            "", {signupInfo}
        ) as SignupSuccessResponse;
    }

    async recoveryHandler(
        params: RecoveryUpParams
    ):Promise<RecoveryResponse> {

        const {
            ctx,
            username,
            usernameType,
            password,
        } = params;

        const recoveryInfo:RecoveryInfo = {
            type: "up",
            username, usernameType
        }
        
        // username does not exist?
        if (
            !await this.#getUserId(
                username, usernameType
            )
        ) {         
            return {
                type: "error",
                code: "err-username-not-exists",
                params: {
                    username
                },
                data: {recoveryInfo}
            } as RecoveryErrorResponse;

        }

        // username verification
        if (
            this.settings.verificationRequire &&
            ["email", "phone"].includes(usernameType)
        ) {

            const res = await this.runA(
                "is-user-verified",
                {
                    ctx,
                    type: usernameType,
                    value: username
                }
            );

            if (!res) {
                this.log.warn("warn-no-verification-response", {
                    type: usernameType,
                    value: username,
                    response: res
                });
                return Msg.error(
                    "err-internal"
                ) as RecoveryErrorResponse;
            }

            if (!res.verified) {
                this.log.security(
                    "sec-recovery-without-verification",
                    {
                        type: usernameType,
                        value: username,
                        response: res
                    }
                );
                return Msg.error(
                    "err-internal"
                ) as RecoveryErrorResponse;
            }
        }

        // all good, do the signup now        

        this.log.info("msg-recovery-user-up", {
            recoveryInfo
        });

        // generating password hash
        let {hash: pwdHash}:{hash: string} = 
            await this.runA(
                "generate-hash", {
                    hashingType: this.settings.pwdHashingType,
                    text: password,
                }
            ) || {};
        // generate-hash channel not handled
        if (!pwdHash) {
            this.log.warn("warn-no-generate-hash-chan-response", {
                hashingType: this.settings.pwdHashingType
            });
            // raw hashing
            pwdHash = password;
        }

        // resetting the password

        const loginCol = await this.getCollection(
            "login-up",
            {exact: true}
        );

        try {

            await loginCol.updateOne({
                [`username.${usernameType}`]: username
            }, {
                $set: {password: pwdHash}
            });

            this.log.success(
                "suc-login-doc-pwd-update",
                {recoveryInfo}
            );

        }
        catch(error) {

            this.log.error(
                "err-login-doc-pwd-update-failed",
                {error, recoveryInfo}
            );

            return Msg.error(
                "err-internal", {}
            ) as RecoveryErrorResponse;
        }


        return Msg.success(
            "", {recoveryInfo}
        ) as RecoverySuccessResponse;
        
    }

    async #getUserId(
        username: string, usernameType: string
    ):Promise<ObjectId|null> {
        
        const col = await this.getCollection(
            "login-up",
            {exact: true}
        );

        const doc = await col.findOne({
            [`username.${usernameType}`]:username
        });
        return doc && doc.userId;
    }
}
