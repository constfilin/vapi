import util                 from 'node:util';

import WebSocket            from 'ws';
import express              from 'express';
import * as expressCore     from 'express-serve-static-core';
// import { Vapi }             from '@vapi-ai/server-sdk';

import { server }           from '../Server';
import { getCmdPromise }    from '../getCmdPromise';
import dayjs                from '../day-timezone';
import * as misc            from '../misc';

import stateByAreaCode      from './stateByAreaCode';
import * as VapeApi         from './VapeApi';

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
const findLastToolCallTo = ( messageItems:Vapi.CallMessagesItem[], toolName:string ) : (Vapi.ToolCall|undefined) => {
    if( !Array.isArray(messageItems) )
        throw Error(`messages is not an array`);
    let result = undefined as (Vapi.ToolCall|undefined);
    const lastCallToolMessageItem = messageItems.findLast( mi => {
        if( mi.role!=='tool_calls' )
            return false;
        const tcmi      = mi as Record<string,any>;
        const toolCalls = (tcmi.tool_calls||tcmi.toolCalls||tcmi.toolCallList) as Vapi.ToolCall[];
        if( !Array.isArray(toolCalls) )
            return false;
        result = toolCalls.findLast( tc => {
            if( tc.type!=='function' )
                return false;
            const tcFunction = tc['function'];
            if( typeof tcFunction!=='object' )
                return false;
            if( tcFunction.name!==toolName )
                return false;
            if( !["object","string"].includes(typeof tcFunction.arguments) )
                return false;
            return true;
        });
        return !!result;
    });
    return result;
}
const getLastToolCallToAgrs = ( 
    messageItems: Vapi.CallMessagesItem[], 
    toolName    : string,
    dflt        : Record<string,any> = {}
 ) : Record<string,any> => {
    const lastToolCall = findLastToolCallTo(messageItems,toolName);
    if( !lastToolCall )
        return dflt;
    const lastToolCallFunction  = lastToolCall['function'] as Vapi.ToolCallFunction;
    if( !lastToolCallFunction || typeof lastToolCallFunction!=='object' )
        return dflt;
    return (typeof lastToolCallFunction.arguments==='object') ? lastToolCallFunction.arguments : 
        (typeof lastToolCallFunction.arguments==='string') ? misc.jsonParse(lastToolCallFunction.arguments as unknown as string,dflt) :
        dflt;
}
const guessState = ( phoneNumber:string ) : string => {
    // Guess the state from the phone number
    const re = /^(\+1)?(\d{3})\d{7}/;
    const match = phoneNumber.match(re);
    if( !match )
        return 'unknown';
    return stateByAreaCode[match[2]] || 'unknown';
}
// probably not needed on elevenlabs
// const guessSessionId = ( vapi_message:Vapi.ServerMessageToolCalls ) : string => {
//     if( vapi_message.call?.id )
//         return vapi_message.call.id;
//     // By experimentation it was found that the chat ID gets changed with every new chat message
//     // but the assistant ID remains the same throughout the session
//     //if( vapi_message.chat?.id )
//     //    return vapi_message.chat.id;
//     const assistant = vapi_message.assistant as typeof vapi_message.assistant & { id?:string };
//     if( vapi_message.chat?.createdAt )
//         return `${assistant?.id||'unknown_assistant'}_${vapi_message.chat.createdAt}`;
//     if( assistant?.id )
//         return assistant.id;
//     return 'unknown_session';
// }

export default () => {
    const router   = express.Router();
    router.post('/tool/sendEmail',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const { to, subject, text } = req.body as Record<string,any>;
            if( !to || !subject || !text )
                throw Error(`Invalid arguments`);
            await server.sendEmail({ to, subject, text });
            return `Email is sent to ${to}`;
        });
    });
    router.post('/tool/dispatchCall',(req:expressCore.Request,res:expressCore.Response) => {
        
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const { name } = req.body as Record<string,any>;
            if( !name )
                throw Error(`Invalid arguments`);
            const contacts = await server.getContacts();
            const canonicalName = misc.canonicalizePersonName(name);
            const contact = contacts.find( c => {
                // Note: column names are case sensitive
                return c.name===canonicalName;
            });
            if( !contact )
                throw Error(`Cannot find name '${canonicalName}' in ${server.config.worksheetName}`);
            const djs    = dayjs().tz(contact.timeZone||'America/Los_Angeles');
            const hour   = djs.hour();
            const vmPrompt = contact.vmPrompt || `to describe its issue to '${canonicalName}'`;
            const result =  ([0,6].includes(djs.day()) || (hour<contact.businessStartHour) || (hour>=contact.businessEndHour)) ?
                `ask the user ${vmPrompt}, save its answer to a text and call sendEmail to ${contact.emailAddresses[0]} with subject "Call to ${contact.name} from ${vapi_message?.customer?.number||'n/a'}" and that text` :
                `ask user to confirm that the user wants to talk to '${canonicalName}'. If user confirms, then call redirectCall with +1${contact.phoneNumbers[0]}. Otherwise ask user again the user wants to speak to.`;
            server.module_log(module.filename,2,`Handled 'dispatchCall'`,{ name },result);
            return result;
        });
    });
    router.post('/tool/guessState',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const { phoneNumber } = req.body as Record<string,any>;
            if( !phoneNumber )
                throw Error(`Invalid arguments`);
            return guessState(phoneNumber);
        });
    });
    router.post('/tool/getUserByPhone',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const { phoneNumber } = req.body as Record<string,any>;
            if( !phoneNumber )
                throw Error(`Invalid arguments`);
            return VapeApi.getUserByPhone(guessSessionId(req.body as Vapi.ServerMessageToolCalls),phoneNumber);
        });
    });
    router.post('/tool/dispatchUserByPhone',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const phoneNumber = server.config.simulatedPhoneNumber || (req.body as Record<string,any>).phoneNumber;
            if( !phoneNumber )
                throw Error(`Invalid phone number`);
            const sessionId = (req.body as Record<string,any>).sessionId;
            if( !sessionId )
                throw Error(`Invalid session ID`);
            return VapeApi.getUserByPhone(sessionId,phoneNumber)
                .then( userInfo => {
                    return {
                        userInfo,
                    };
                })
                .catch( err => {
                    return {
                        err: "No user found"
                    }
                });
        });
    });
    router.post('/tool/getFAQAnswer',(req:expressCore.Request,res:expressCore.Response) => {
        const sessionId = (req.body as Record<string,any>).sessionId;
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            const { question } = req.body as Record<string,any>;
            if( !question )
                throw Error(`Invalid arguments`);
            return VapeApi.getFAQAnswer(sessionId ,question);
        });
    });
    router.post('/assistant/*',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            // The customer requests an email to be sent to the customer if the call is transferred to a number
            // First try the easy way
            const serverMessage  = (req.body as Vapi.ServerMessage).message as Vapi.ServerMessageMessage;
            server.module_log(module.filename,2,`Got assistant notification '${serverMessage.type||'??'}'`,{
                status          : (serverMessage as any).status,
                request         : (serverMessage as any).request,
                assistantsName  : serverMessage.assistant?.name,
            });
            if( serverMessage.type==='end-of-call-report') {
                const messageItems = (serverMessage as unknown as Vapi.Call).messages as Vapi.CallMessagesItem[];
                let notificationEmailAddress = server.config.notificationEmailAddress || 'mkhesin@intempus.net'; // default
                //try {
                //    notificationEmailAddress = await guessSummaryEmailAddress(messageItems);
                //}
                //catch( err ) {
                //    server.module_log(module.filename,1,`Cannot guess summary email address (${err.message}), defaulting to '${notificationEmailAddress}'`);
                //}
                if( getLastToolCallToAgrs(messageItems,'sendEmail',{}).to===notificationEmailAddress ) {
                    server.module_log(module.filename,2,`Summary email already sent to '${notificationEmailAddress}'`);
                }
                else {
                    const summaryEmailText = (serverMessage.analysis.summary||'Summary was not provided').replace(/in\s*tempest/gi,'Intempus');
                    server.sendEmail({
                        to      :   notificationEmailAddress,
                        subject :   `Call to ${serverMessage.assistant?.name}`,
                        text    :   summaryEmailText
                    }).then(() => {
                        server.module_log(module.filename,2,`Sent email with call summary '${summaryEmailText}' to '${notificationEmailAddress}'`);
                    }).catch( err => {
                        server.module_log(module.filename,1,`Cannot send an email with call summary '${summaryEmailText}' to '${notificationEmailAddress}' (${err.message})`);
                    });
                }
            }
            else if( serverMessage.type==='status-update' ) {
                const su_server_message = serverMessage as Vapi.ServerMessageStatusUpdate;
                const call              = su_server_message.call;
                const listenUrl         = call?.monitor?.listenUrl;
                if( !listenUrl )
                    throw Error(`listenUrl is not provided in '${serverMessage.type}' server message`);
                if( su_server_message.status==='in-progress' ) {
                    if( server.config.open_ws ) {
                        const ws = new WebSocket(listenUrl);
                        ws.on('open',() => {
                            server.module_log(module.filename,1,`WebSocket connection established with '${listenUrl}'`);
                        });
                        ws.on('message', (data, isBinary) => {
                            if (isBinary) {
                                server.module_log(module.filename,4,`Received binary PCM data`);
                            } 
                            else {
                                server.module_log(module.filename,2,`Received message on '${listenUrl}':`,data.toString());
                            }
                        });
                        ws.on('close', () => {
                            server.module_log(module.filename,2,`WebSocket connection is closed with '${listenUrl}'`);
                        });
                        ws.on('error',(error) => {
                            server.module_log(module.filename,2,`WebSocket error with '${listenUrl}':`,error);
                        });
                        if( server.ws_by_url[listenUrl] )
                            server.ws_by_url[listenUrl].close();
                        server.ws_by_url[listenUrl] = ws;
                    }
                }
                else if( su_server_message.status==='ended' ) {
                    const ws = server.ws_by_url[listenUrl];
                    if( ws ) {
                        try {
                            ws.close();
                            delete server.ws_by_url[listenUrl];
                        }
                        catch( err ) {
                            server.module_log(module.filename,1,`Cannot find WS by '${listenUrl}' (${err.message})`);
                        }
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
            if( req.get(server.config.web.header_name)!==server.config.elevenLabsToolSecret )
                throw Error(`Access denied`);
            return getCmdPromise(req.body as Record<string,any>)();
        });
    });
    router.options('/tool',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,() => {
            res.setHeader('Access-Control-Allow-Origin', 'https://api.elevenlabs.io');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            return '';
        });
    });
    return router;
};
