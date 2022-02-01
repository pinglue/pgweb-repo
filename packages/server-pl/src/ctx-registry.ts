
import formidable from "formidable";

import type {
    RequestInfo,
    RequestContext
} from "@pgweb/utils/node";

import {Msg, _merge, _clone} from "@pinglue/utils";

import type {
    IncomingMessage,
    ServerResponse
} from "http";

const MAX_CTX_ID = 1000000000;

type CtxObject = {

    //the request header (an instance of IncomingMessage). Note that the body is not parsed (nobody method) - The particular interests: req.headers and req.method
    req: IncomingMessage;

    //the response (an instance of ServerResponse) the response
    res: ServerResponse;

    info: RequestInfo;
};

type Settings = {uploadPath: string};

export class CtxRegistry {

    #ctxIdCounter = 1;

    #settings: Settings;

    // formidable object to parse request body and files
    //#form: IncomingForm;

    // map of ctx id => CtxObject
    #ctxObjs: Map<number, CtxObject> = new Map();

    constructor(settings: Settings) {

        this.#settings = settings;

        /*const form = formidable({
            multiples: true,
            uploadDir: settings.uploadPath
        });*/

    }

    /**
     *
     * @param req
     * @param res
     * @throws
     */
    async register(
        req: IncomingMessage,
        res: ServerResponse
    ): Promise<RequestInfo> {

        const form = formidable({
            multiples: true,
            uploadDir: this.#settings.uploadPath
        });

        const {fields, files}: {
            fields: formidable.Fields;
            files: formidable.Files;
        } = await new Promise((resolve, reject) => {

            form.parse(
                req,
                (error, fields, files) => {

                    if (error)
                        reject(error);
                    else
                        resolve({fields, files});

                }
            );

        });

        const ctx: RequestContext = {
            id: this.#genCtxId()
        };

        const info: RequestInfo = {
            ctx,
            reqStatus: req.statusCode,
            reqUrl: req.url,
            reqHeaders: req.headers,
            reqBody: fields,
            resStatus: 200,
            resHeaders: {},
            resBody: {},
            files
        };

        this.#ctxObjs.set(ctx.id, {
            req, res, info
        });

        return info;

    }

    #genCtxId(): number {

        for(
            let offset = 0;
            offset < MAX_CTX_ID;
            offset++
        ) {

            const id = ((this.#ctxIdCounter + offset) % MAX_CTX_ID) + 1;

            if (!this.#ctxObjs.has(id)) {

                this.#ctxIdCounter =
                    (this.#ctxIdCounter + offset + 1) % MAX_CTX_ID;
                return id;

            }

        }

        throw Msg.error("err-no-ctx-id-available");

    }

    /**
     *
     * @param ctx
     * @returns
     * @throws
     */
    getCtxObj(ctx: RequestContext): CtxObject {

        if (!ctx?.id)
            throw Msg.error("err-no-ctx-id", {ctx});

        const ctxObj = this.#ctxObjs.get(ctx.id);
        if (!ctxObj)
            throw Msg.error("err-ctx-not-exist", {ctx});

        return ctxObj;

    }

    /**
     *
     * @param ctx
     * @throws
     */
    getReqInfo(ctx: RequestContext): RequestInfo {

        const ctxObj = this.getCtxObj(ctx);
        return ctxObj.info;

    }

    /**
     *
     * @param reqInfo
     * @throws
     */
    updateInfo(reqInfo: RequestInfo) {

        const {ctx, reqStatus, reqHeaders, resStatus, resHeaders, resBody} = reqInfo;

        const info = this.getReqInfo(ctx);

        _merge(info, {reqStatus, reqHeaders, resStatus, resHeaders, resBody});

    }

    close(ctx: RequestContext) {

        this.#ctxObjs.delete(ctx.id);

    }

}