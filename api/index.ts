import util                 from 'node:util';

import WebSocket            from 'ws';
import express              from 'express';
import * as expressCore     from 'express-serve-static-core';
import { Vapi }             from '@vapi-ai/server-sdk';

import { server }           from '../Server';
import { getCmdPromise }    from '../getCmdPromise';
import * as misc            from '../misc';

const sendResponse = ( 
    req     : expressCore.Request, 
    res     : expressCore.Response, 
    response: any 
) => {
    const start_at = Date.now();
    const log_response = ( response:any ) => {
        const duration_ms = Date.now()-start_at;
        if( Array.isArray(response) ) {
            const elems_to_log = 3;
            const slice_to_log = response.slice(0,elems_to_log);
            server.module_log(
                module.filename, 1, `${req.method} to ${req.originalUrl} (${duration_ms}ms):`,
                slice_to_log,
                `(${response.length} elems)`
            );
        }
        else {
            let str_to_log = String(response);
            if( str_to_log==='[object Object]' )
                str_to_log = JSON.stringify(response);
            server.module_log(
                module.filename, 1, `${req.method} to ${req.originalUrl} (${duration_ms}ms):`,
                str_to_log.substring(0,50),
                `(${str_to_log?.length} chars)`
            );
        }
    }
    const log_and_send_response = ( value:any ) => {
        log_response(value);
        res.send(value);
        res.end();
        return value;
    };
    const err_to_response = ( err:Error ) : Record<string,any> => {
        // Make sure to remove all stack and tec details
        // .err in the result will indicate an error
        return {
            err : err.message,
        };
    }
    // Else convert result to something that we can send
    if( response instanceof Function ) {
        try {
            response = response();
        }
        catch( err ) {
            // common.module_log(module.filename,0,`exception on function `,err);
            return log_and_send_response(err_to_response(err as Error));
        }
    }
    if( util.types.isPromise(response) ) {
        return response.then(log_and_send_response).catch( err => {
            server.module_log(module.filename,0,`exception on promise `,err);
            return log_and_send_response(err_to_response(err));
        });
    }
    return log_and_send_response(response);
}

const matchToolcallResultMessage = ( vapi_message:Vapi.ServerMessageMessage, re:RegExp ) : (RegExpMatchArray|null) => {
    const message_items = (vapi_message as unknown as Vapi.Call).messages as Vapi.CallMessagesItem[];
    if( !Array.isArray(message_items) )
        return null;
    return (message_items as Vapi.ToolCallResultMessage[]).reduce( (acc,mi,mindx) => {
        if( mi.role!=='tool_call_result' )
            return acc;
        const matches = mi.result.match(re);
        if( !matches )
            return acc;
        return matches;
    },null as (RegExpMatchArray|null));
}

export default () => {
    const router   = express.Router();
    router.post('/tool',async (req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.vapiToolSecret )
                throw Error(`Access denied`);
            const vapi_message  = (req.body as Vapi.ServerMessage).message as Vapi.ServerMessageToolCalls;
            const tool_calls    = vapi_message?.toolCallList;
            if( !Array.isArray(tool_calls) )
                throw Error(`Invalid arguments`);
            return {
                // For each tool in the `toolCalls` return a result
                results : await Promise.all(tool_calls.map( tc => {
                    const args = tc['function'].arguments;
                    switch( tc['function'].name ) {
                    case 'sendEmail':
                        if( !args || !(args.to||args.destination) || !args.subject || !args.text ) {
                            return {
                                toolCallId  : tc.id,
                                result      : `No args found in function name '${tc['function'].name}'`
                            };
                        }
                        return server.sendEmail({
                            to      :   (args.to||args.destination) as string,
                            subject :   args.subject as string,
                            text    :   args.text as string
                        }).then(() => {
                            server.module_log(module.filename,2,`Handled '${tc['function'].name}'`,args);
                            return {
                                toolCallId  : tc.id,
                                result      : `Email is sent to ${args.to||args.destination}`
                            }
                        });
                    case 'dispatchCall':
                        if( !args ) {
                            return {
                                toolCallId  : tc.id,
                                result      : `No args found in function name '${tc['function'].name}'`
                            };
                        }
                        return server.dispatchCall(args.name as string).then( result => {
                            server.module_log(module.filename,2,`Handled '${tc['function'].name}'`,args,result);
                            return {
                                toolCallId  : tc.id,
                                result      : result
                            }
                        });
                    }
                    return {
                        toolCallId  : tc.id,
                        result      : `Unknown function ${tc['function'].name}`
                    }
                }))
            }
        });
    });
    router.post('/assistant',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.vapiToolSecret )
                throw Error(`Access denied`);
            // The customer requests an email to be sent to the customer if the call is transferred to a number
            // First try the easy way
            const server_message  = (req.body as Vapi.ServerMessage).message as Vapi.ServerMessageMessage;
            server.module_log(module.filename,2,`Got assistant notification '${server_message.type}/${(server_message as any).status||'??'}'`);
            if( server_message.type==='end-of-call-report') {
                const eocr_server_message = server_message as Vapi.ServerMessageEndOfCallReport;
                const phone_number = eocr_server_message.customer?.number;
                if( !phone_number )
                    return {
                        err : `Customer phone number is not provided`
                    }
                const c = await server.getContacts().then( contacts => {
                    const clean_phone_number = misc.canonicalizePhone(phone_number);
                    const c = contacts.find( c => {
                        return c.phoneNumbers.includes(clean_phone_number);
                    });
                    return c;
                });
                const email_address = c?.emailAddresses[0];
                if( !email_address )
                    return {
                        err : `Cannot figure out the email address of phone '${phone_number}'`
                    };
                if( matchToolcallResultMessage(eocr_server_message,new RegExp(`^email\\s+is\\s+sent\\s+to\\s+${c?.emailAddresses[0]}$`,'i')) )
                    return {
                        err : `Email is already sent to ${email_address}`
                    };
                const text = eocr_server_message.analysis.summary||'Summary was not provided';
                server.sendEmail({
                    to      :   c.emailAddresses[0],
                    subject :   `Call to ${eocr_server_message.assistant?.name}`,
                    text    :   text
                }).then(() => {
                    server.module_log(module.filename,2,`Sent email with call summary '${text}' to '${email_address}'`);
                }).catch( err => {
                    server.module_log(module.filename,1,`Cannot send an email with call summary '${text}' to '${email_address}' (${err.message})`);
                });
            }
            else if( server_message.type==='status-update' ) {
                const su_server_message = server_message as Vapi.ServerMessageStatusUpdate;
                const call              = su_server_message.call;
                const listenUrl         = call?.monitor?.listenUrl;
                if( !listenUrl )
                    throw Error(`listenUrl is not provided in '${server_message.type}' server message`);
                if( su_server_message.status==='in-progress' ) {
                    const ws = new WebSocket(listenUrl);
                    ws.on('open',() => {
                        console.log(`WebSocket connection established with '${listenUrl}'`);
                    });
                    ws.on('message', (data, isBinary) => {
                        if (isBinary) {
                            console.log(`Received binary PCM data`);
                        } else {
                            console.log(`Received message on '${listenUrl}':`,data.toString());
                        }
                    });
                    ws.on('close', () => {
                        console.log(`WebSocket connection is closed with '${listenUrl}'`);
                    });
                    ws.on('error',(error) => {
                        console.error(`WebSocket error with '${listenUrl}':`,error);
                    });
                    server.ws_by_url[listenUrl] = ws;
                }
                else if( su_server_message.status==='ended' ) {
                    const ws = server.ws_by_url[listenUrl];
                    try {
                        ws?.close();
                    }
                    catch( err ) {
                        server.module_log(module.filename,1,`Cannot find WS by '${listenUrl}' (${err.message})`);
                    }
                }
            }
            else {
                // Not handled
            }
            return {
                // nothing in particular needs to be returned
            };
        });
    });
    router.post('/cmd',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,() => {
            if( req.get(server.config.web.header_name)!==server.config.vapiToolSecret )
                throw Error(`Access denied`);
            return getCmdPromise(req.body as Record<string,any>)();
        });
    });
    return router;
};
