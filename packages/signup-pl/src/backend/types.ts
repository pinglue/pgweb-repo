
import type {
    Object,
    Message
} from "@pinglue/utils";

export type UsernameType = "email" | "phone" | "name";

// the data to be sent upon a successful Signup
export type SignupInfo = {

    // examle: "up"-> username/password signup - "google", etc.
    type: string;

    usernameType?: UsernameType;
    username?: string;

    socialId?: string;

    registerDate?: number;

};

export type SignupData = {
    signupInfo: SignupInfo;
    // reserve for other info
};

export interface SignupSuccessResponse extends Message {

    type: "success";

    data: SignupData;
}

export interface SignupErrorResponse extends Message {
    type: "error";

    data: {
        signupInfo?: SignupInfo;
        [other: string]: any;
    };
}

export type SignupResponse =
    SignupSuccessResponse | SignupErrorResponse;

export type SignupUpParams = {
    ctx: RequestContext;
    username: string;
    usernameType: UsernameType;
    password: string;
    userInfo: Object;
};

// the data to be sent upon a successful Signup
export type RecoveryInfo = {

    // examle: "up"-> username/password login - "google", etc.
    type: string;

    usernameType?: UsernameType;
    username?: string;

    socialId?: string;

};

export type RecoveryData = {
    recoveryInfo: RecoveryInfo;
    // reserve for other info
};

export interface RecoverySuccessResponse extends Message {

    type: "success";

    data: RecoveryData;
}

export interface RecoveryErrorResponse extends Message {
    type: "error";

    data: {
        recoveryInfo?: RecoveryInfo;
        [other: string]: any;
    };
}

export type RecoveryResponse =
RecoverySuccessResponse | RecoveryErrorResponse;

export type RecoveryUpParams = {
    ctx: RequestContext;
    username: string;
    usernameType: UsernameType;
    password: string;
};


import type {BackendControllerSettings, RequestContext} from "@pgweb/utils/node";

export interface BackendSettings extends BackendControllerSettings {
    pwdHashingType: string;
    verificationRequire: boolean;
}
