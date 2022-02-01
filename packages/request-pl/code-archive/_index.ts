
import path from "path";
import formidable from "formidable";
import IncomingForm from "formidable/Formidable";

import {Msg, _merge, _clone} from "@pinglue/utils";
import {Controller} from "pinglue";
import { IncomingMessage, ServerResponse } from "http";

import {RemoteChanSct} from "./remote-chan-sct.js";

const MAX_CTX_ID = 1000000000;

type ReqHandlerParams = {
    req: IncomingMessage,
    res: ServerResponse
}

type SendHandlerParams = {
    ctx: RequestContext,
    msg?: Message
}

type CtxObject = {

    //the request header (an instance of IncomingMessage). Note that the body is not parsed (nobody method) - The particular interests: req.headers and req.method
    req: IncomingMessage

    //the response (an instance of ServerResponse) the response
    res: ServerResponse

    //the request message sent from the frontend (a PgReq instance)
    pgReq: RequestService;

    // headers to be sent
    headers?: GenericObject;

    // info's related to the files uploaded from the frontend
    filesInfo?: formidable.Files;

    // Any error that happened related to this context
    error?: Message;

    // the controller that this request belongs to
    controllerId: string;

    // whether the response has been sent
    isSent?: boolean;
}

export default class extends Controller {

    protected settings: Settings;

    ctxIdCounter = 1;

    // formidable object to parse request body and files
    form: IncomingForm;

    // map of ctx id => CtxObject
    ctxObjs:Map<number, CtxObject> = new Map();

    async init() {

        this.form = formidable({
            multiples: true,
            uploadDir: path.join(
                this.dataPath,
                this.settings.uploadDir || "tmp-uploads"
            )
        });        

        // channels

        this.regChannel("api-request", {
            runMode: "no-value",
            singleHandler: true,
            noCloneParams: true
        });
        this.regChannel("pre-process-req-ctx");

        this.regChannel("frontend-request", {
            runMode: "no-value",
            noCloneParams: true            
        });
        this.regChannel("get-request-headers", {
            singleHandler: true,
            syncType: "sync"
        });
        this.regChannel("set-response-headers", {
            runMode: "no-value",
            singleHandler: true,
            syncType: "sync"
        });
        this.regChannel("process-api-req", {
            runMode: "no-value"
        });
        this.regChannel("before-send-response");
        this.regChannel("send-response", {
            singleHandler: true
        });
        this.regChannel("before-close-ctx", {
            runMode: "no-value"
        });


        await this.newSubController(
            "remote-chan",
            RemoteChanSct
        );
        
  
        this.glue(
            "api-request", 
            this.requestHandler.bind(this)
        );

        this.glue(
            "send-response",
            this.sendHandler.bind(this)
        );

        this.glue(
            "get-request-headers",
            this.getHeadersHandler.bind(this)
        );

        this.glue(
            "set-response-headers",
            this.setHeadersHandler.bind(this)
        );
        
    }

    
    async requestHandler(
        {req, res}: ReqHandlerParams
    ):Promise<void> {

        const url = req.url;
        this.log("msg-incoming-api-request", {url});

        // validating the request
        if (res.writableEnded) {
            this.log.error("err-request-already-sent", {url});
            return;
        }

        // extracting the controllerid
        const controllerId = url.split("/")
            .filter(x => !!x.trim())?.[0];        

        // TODO: more checks if url belogs to a backend registered controller
        if (!controllerId) {                   
            this.log.error("err-request-no-ct-id-found", {url});
            res.end(JSON.stringify({
                pgRes: Msg.error("err-request-no-ct-id-found")
            }));
            return;
        }

        let parseResult: {
            fields: formidable.Fields,
            files: formidable.Files
        };

        try {
        // extracting the request body
            parseResult = await new Promise((resolve, reject) => {
                this.form.parse(req, (error, fields, files) => {

                    if (error) 
                        reject(error);
                    else 
                        resolve({fields, files});
                });
            });
        }
        catch(error) {
            this.log.error("err-parsing-req-body", {
                url,
                error
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-parsing-req-body")
            }));
            return;
        }

        const {fields, files} = parseResult;
        

        // validating pgReq
        if (!fields.pgReq) {
            this.log.error("err-empty-pgreq-field", {
                url,
                pgReqField: fields.pgReq
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-empty-pgreq-field")
            }));
            return;            
        }
        if (
            typeof fields.pgReq !== "string"
        ) {
            this.log.error("err-multi-pgreqs", {
                url,
                pgReqField: fields.pgReq
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-multi-pgreqs")
            }));   
            return;         
        }

        // parsing pgreq
        let pgReq: RequestService;
        try {
            pgReq = JSON.parse(fields.pgReq);
        }
        catch(error) {
            this.log.error("err-pgreq-json-parse-failed", {
                url,
                pgReqField: fields.pgReq
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-pgreq-json-parse-failed")
            })); 
            return;
        }

        if (!pgReq) {
            this.log.error("err-empty-pgreq-obj", {
                url,
                pgReq
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-empty-pgreq-obj")
            }));
            return;
        }

        if (
            typeof pgReq.cmd !== "string" ||
            !pgReq.cmd.trim()            
        ) {
            this.log.error("err-pgreq-cmd-wrong-format", {
                url,
                cmd: pgReq.cmd
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-pgreq-cmd-wrong-format")
            }));   
            return;         
        }

        // creating the context

        const ctx:RequestContext = {
            id: this.genCtxId()
        }
        const ctxObj:CtxObject = {
            req, 
            res,
            pgReq: {
                cmd: pgReq.cmd.trim(),
                params: pgReq.params || {}
            },
            filesInfo: files,
            headers: {},
            controllerId            
        };
        this.ctxObjs.set(ctx.id, ctxObj);

        this.log("msg-ctx-created", {ctxId:ctx.id});

        /* request flow
        -------------------- */
        
        // step 1
        await this.runA(
            "pre-process-req-ctx", null, ctx
        );

        this.log("msg-ctx-after-pre-process", ctx);

        // step 2
        await this.runA(
            "process-api-req", 
            {ctx, pgReq:ctxObj.pgReq}, undefined,
            {filter: controllerId}
        );

        if (!ctxObj.isSent) {
            this.log.error("err-ct-unfinished-process", {
                controllerId,
                url,
                ctxId: ctx.id
            });
            res.end(JSON.stringify({
                pgRes: Msg.error("err-ct-unfinished-process")
            }));
            ctxObj.isSent = true;
        }       

        // step 3: closing the context
        
        this.log("msg-closing-ctx", {ctxId: ctx.id});
        await this.runA("before-close-ctx", {ctx});

        this.ctxObjs.delete(ctx.id);

    }

    /**
     * @throws is none is available (max-connection-number reached?)
     */
    genCtxId(): number {

        for(
            let offset=0; 
            offset<MAX_CTX_ID;
            offset++
        ) {
            const id = ((this.ctxIdCounter+offset)%MAX_CTX_ID)+1;
            if (!this.ctxObjs.has(id)) {
                this.ctxIdCounter = 
                    (this.ctxIdCounter+offset+1)%MAX_CTX_ID
                return id;
            }
        }

        this.log.error("err-no-ctx-id-available");
        throw Msg.error("err-no-ctx-id-available");

    }

    /**
     * 
     * @param ctx 
     * @throws if ctx is not valid (i.e., ctx.id does not exist in ctxObjs map)
     */
    getCtxObj(ctx: RequestContext):CtxObject {

        if (!ctx.id)
            throw Msg.error("err-ctx-has-no-id", {ctx});
        
        const ctxObj = this.ctxObjs.get(ctx.id);
        if (!ctxObj) 
            throw Msg.error("err-ctx-not-exist", {ctx});

        return ctxObj;

    }

    async sendHandler(
        {ctx, msg}: SendHandlerParams
    ):Promise<void> {

        this.log("msg-sending-response", {ctxId:ctx.id});

        // fetching the ctx object
        const ctxObj = this.getCtxObj(ctx);
        
        if (!msg) msg = Msg.success();

        // TODO: in the future we can add more fields to the resBody from the context
        
        const {headers, resBody, status} = 
            await this.runA(
                "before-send-response",
                {ctx},
                {
                    headers:{},
                    resBody: {
                        pgRes: msg
                    },
                    status: 200
                }
            );

        // merging headers
        _merge(ctxObj.headers, headers);

        // serializing the response
        let bodyStr:string;
        try {
            bodyStr = JSON.stringify(resBody);
        }
        catch(error) {
            this.log.error("err-response-body-serialization-failed", {
                resBody
            });
            return;
        }

        ctxObj.res.writeHead(
            status, ctxObj.headers
        ).end(bodyStr);
        ctxObj.isSent = true;
       
    }

    getHeadersHandler({ctx}:{ctx:RequestContext}) {

        const ctxObj = this.getCtxObj(ctx);

        return _clone(ctxObj.req.headers);

    }

    setHeadersHandler(params:{
        ctx:RequestContext;
        headers: GenericObject
    }) {

        const ctxObj = this.getCtxObj(params.ctx);

        _merge(ctxObj.headers, params.headers);
    }
    

}

/* Aux functions
====================== */



