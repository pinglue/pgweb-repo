
import type {Files} from "formidable";

import {
    Message,
    Object
} from "@pinglue/utils";

/**
 * To be used in th backend to carry the req,res data. An instance of this class, often called ctx, is passed to different channel handlers.
 */
export type RequestContext = {

    // a unique id for this context.
    id: number;

    // the session id associated to this context
    sid?: string | number;

};

export type RequestInfo = {

    ctx?: RequestContext;

    // will be sync with req.statusCode when proxying
    reqStatus?: number;

    // will be sync with req.url when proxying
    reqUrl?: string;

    // request headers (readonly, equals to req.headers)
    reqHeaders?: Object;

    // the request body (after parsing)
    reqBody?: Object;

    resStatus?: number;

    // headers to be sent
    resHeaders?: Object;

    // the body to be sent
    resBody?: Object;

    // info's related to the files uploaded from the frontend
    // TODO: replace this with a definition same as formidable.Files (don't use formidable directly, re-define it here as a guarding layer)
    files?: any;

    // Any error that happened related to this context
    error?: Message;

    // whether the response has been sent
    isSent?: boolean;
};
