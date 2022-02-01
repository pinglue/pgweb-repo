
//import type {Object} from "@pinglue/utils";

import {BackendController, BackendControllerSettings, RequestContext} from "@pgweb/utils/node";

import {Msg} from "@pinglue/utils";

type VerificationType = "email" | "phone";

type VerifyParams = {
    ctx: RequestContext;
    type: VerificationType;
    value: string;
}

type ValidateCodeParams = {
    ctx: RequestContext;
    type: VerificationType;
    value: string;
    code: string;
}

export interface Settings extends BackendControllerSettings {

    maxCodeSends: number;
    maxAttempts: number;
    ttv: number;
    ttl: number;

    email?: {
        subject: string;
        contentType?: "text" | "html";
        subjectTemplate: {
            text?: string;
            path?: string;
        };
        template: {
            type?: string;
            text?: string;
            path?: string;
        }

    }

    phone?: {        
        template: {
            type?: string;
            text?: string;
            path?: string;
        }
    }
}



export enum VerificationStatus {
    PENDING,
    VERIFIED
}

export type Verification = {

    type: VerificationType;

    // value to be verified: email address/phone number
    value: string;

    // the milisecond timestamp of this verification creation.
    timestamp: number;

    // number of minutes for this verification to remain valid. Defauts to settings.ttl. Undefined represents forever (as long as the session lives)
    ttl?: number;

    // time to verify. The number of minutes that user has to enter the verification code after sending. Defaults to settings.ttv - undefined means forever
    ttv?: number;

    // The milli-second timestamp of the last code sent
    codeSentTime?: number;

    // the last random code sent. Only when status=pending, after verification this field will be deleted
    code: string;

    // The milli-second timestamp of the verification. Only when status="verified, otherwise this field is undefined
    verifiedTime?: number;

    // the number of times the code was sent
    sentCount: number;

    // number of unsuccessful attempts
    attemptCount: number;

    // (for internal use) 
    status: VerificationStatus;

}

type IsVerifiedResponse = {
    verified: boolean
}

/**
 * Note: If a controller requests verification for an already existing subject then no new verification will be done, and a positive answer will return.
 */
export default class extends BackendController {

    protected settings: Settings;

    async init() {

        this.glue(
            "verify-user", 
            this.verifyHandler.bind(this)
        );

        this.glue(
            "validate-verification-code",
            this.validateCodeHandler.bind(this)
        );

        this.glue(
            "resend-verification-code",
            this.resendCodeHandler.bind(this)
        );

        this.glue(
            "is-user-verified",
            this.isVerifiedHandler.bind(this)
        );

    }

    async isVerifiedHandler(
        params: VerifyParams
    ): Promise<IsVerifiedResponse> {

        const {type, value, ctx} = params;

        try {

            const v = await this.getVerification(
                ctx, type, value
            );

            return {
                verified: v.status === VerificationStatus.VERIFIED
            }

        }
        catch(error) {
            this.log.error("err-is-verified-failed", error);
            return {
                verified: false
            };
        }


    }

    async verifyHandler(params: VerifyParams) {

        const {type, value, ctx} = params;

        this.log("msg-validating", {type, value});
        //this.mark("ctx is", {ctx});

        try {

            let v = await this.getVerification(
                ctx, type, value
            );

            // no valid verification exists - code must be generated
            if (!v) {
                v = await this.setVerification(
                    ctx, type, value
                );
                // sending the code
                await this.sendCode(ctx, v);
                return Msg.success("suc-code-sent");
            }

            else if (v.status === VerificationStatus.VERIFIED) {
                return Msg.success("suc-verified");
            }

            else if (v.status === VerificationStatus.PENDING) {
                return Msg.success("suc-code-already-sent");
            }

        }
        catch(error) {
            this.log.error("err-validation-failed", error);
            return Msg.error("err-internal");
        }
    }

    async validateCodeHandler(params: ValidateCodeParams) {

        const {ctx, type, value, code} = params;

        this.log("msg-validating-code", {
            type, value, code
        });

        let v:Verification;

        try {
            v = await this.getVerification(ctx, type, value);
            if (!v) {
                return Msg.error("err-try-again");                
            }

        }
        catch(error) {
            return Msg.error("err-try-again");
        }

        if (
            this.settings.maxAttempts && 
            v.attemptCount > this.settings.maxAttempts
        ) {
            return Msg.error(                
                "err-verification-max-attempts-reached", 
                {attempts:v.attemptCount}
            );            
        }

        v.attemptCount++;

        if (v.code != code) {
            return Msg.error(                
                "err-incorrect-verification-code"
            );
        }
        else {
            v.status = VerificationStatus.VERIFIED;
            v.verifiedTime = Date.now();
            //delete v.code;
            await this.updateVerification(ctx, v);
            return Msg.success("suc-verified");
        }

    }

    async resendCodeHandler(params: VerifyParams) {

        const {type, value, ctx} = params;

        this.log("msg-resending-code", {type, value});

        try {
            const v:Verification = await this.getVerification(
                ctx,type, value
            );
            if (!v) {
                return Msg.error("err-no-verification");
            }
            await this.sendCode(ctx, v);
            return Msg.success();
        }
        catch(error) {
            return Msg.error("err-internal");
        }
    }

    /**
     * also updates verification info (codeSentTime and sentCount)
     * @param v 
     * @throws
     */
    async sendCode(
        ctx: RequestContext,
        v: Verification
    ) {

        // max send code reached
        if (
            this.settings.maxCodeSends &&
            v.sentCount > this.settings.maxCodeSends
        )
            throw Msg.error(
                "err-verification-max-sent-reached"
            );

        const notification = {
            type: v.type,
            to: v.value,
            subjectTemplate: 
                v.type==="email" && this.settings.email?.subjectTemplate,
            contentType: 
                (v.type==="email" && this.settings.email?.contentType) || "text",
            template:
                this.settings[v.type]?.template as any
        }

        if (!notification.template)
            throw Msg.error(
                "err-no-template-for-sending",
                {
                    vType:v.type, 
                    settingsForType: this.settings[v.type]
                }
            );

        notification.template.data = {
            code: v.code,
            ttv: v.ttv
        }

        // sending notification
        await this.runA("send-notification", {
            ctx,
            notification
        });

        v.codeSentTime = Date.now();
        v.sentCount++;
    }


    /**
     * 
     * @param ctx 
     * @param value 
     * @param type
     * @throws 
     */
    async getVerification(
        ctx: RequestContext, 
        type: VerificationType,
        value: string        
    ):Promise<Verification|null> {

        const key = _getKey(type, value);

        const vStr = await this.getSession(
            ctx, key
        );

        if (!vStr) return null;

        const v:Verification = JSON.parse(vStr);

        const age = Math.round(
            (Date.now() - v.timestamp)/60000
        );
        this.log("msg-retrieving-verification", v);

        // if verification is complete
        if (v.status === VerificationStatus.VERIFIED) {

            if (!v.verifiedTime) {
                await this.unsetSession(ctx, key);
                this.log.error("msg-no-verified-time-found", v);
                throw Msg.error("msg-internal");
            }

            const verifiedAge = Math.round(
                (Date.now() - v.verifiedTime)/60000
            );

            if (v.ttl && verifiedAge >= v.ttl) {                
                await this.unsetSession(ctx, key);
                const period = verifiedAge - v.ttl;
                this.log("msg-verification-expired", {
                    period, type, value
                });
                return null;
            }

            

        }

        else if (v.status === VerificationStatus.PENDING) {

            if (v.ttv && age >= v.ttv) {
                
                await this.unsetSession(ctx, key);
                let period = age-v.ttv;
                this.log("err-verification-code-expired", {
                    type, value, period
                });
                return null;
            }
            
        }

        else {
            this.log.error("err-unknown-status", v);
            await this.unsetSession(ctx, key);
            throw Msg.error("err-internal");
        }

        return v;

    }

    async setVerification(
        ctx: RequestContext, 
        type: VerificationType,
        value: string                
    ):Promise<Verification> {

        const v:Verification = {
            type,
            value,
            timestamp: Date.now(),
            status: VerificationStatus.PENDING,
            code: _genCode(),
            sentCount: 0,
            attemptCount: 0,
            ttl: this.settings.ttl,
            ttv: this.settings.ttv
        }

        const key = _getKey(type, value);
        const vStr = JSON.stringify(v);

        this.mark("setting the v", {key, value});

        await this.setSession(
            ctx, key, vStr
        );

        return v;

    }

    async updateVerification(
        ctx: RequestContext, v: Verification
    ) {
        
        await this.setSession(
            ctx, 
            _getKey(v.type, v.value), 
            JSON.stringify(v)
        );
    }

}

function _genCode() {
    return String(Date.now()%10000);
}

function _getKey(
    type: VerificationType,
    value: string
) {
    return `verification-${type}-${value}`;
}