
import type {
    Object,
    Message
} from "@pinglue/utils";

export type UsernameType = "email" | "phone" | "name";

// the data to be sent upon a successful login
export type LoginInfo = {

    // examle: "up"-> username/password login - "google", etc.
    type: string;

    usernameType?: UsernameType;
    username?: string;

    socialId?: string;

    registerDate?: number;
    currentLoginDate?: number;
    lastLoginDate?: number;

};

export type LoginData = {
    loginInfo: LoginInfo;
    userInfo?: Object;
};

export interface LoginSuccessResponse extends Message {

    type: "success";

    data: LoginData;
}

export interface LoginErrorResponse extends Message {
    type: "error";

    data: {
        loginInfo?: LoginInfo;
        [other: string]: any;
    };
}

export type LoginResponse =
    LoginSuccessResponse | LoginErrorResponse;

export type LoginUpParams = {
    username: string;
    usernameType: UsernameType;
    password: string;
};
