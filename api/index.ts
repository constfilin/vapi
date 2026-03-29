import util                 from 'node:util';

import WebSocket            from 'ws';
import express              from 'express';
import * as expressCore     from 'express-serve-static-core';
import { ElevenLabsApi } from '../ElevenLabsApi';

import { server }           from '../Server';
import { getCmdPromise }    from '../getCmdPromise';
import dayjs                from '../day-timezone';
import * as misc            from '../misc';

import stateByAreaCode      from './stateByAreaCode';
import * as VapeApi         from './VapeApi';
import crypto               from 'crypto';

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
const getEmailToolCall = ( serveMessage: Record<string,any> ) : (Record<string,any>|undefined) => {
    const transcript = serveMessage?.transcript as Record<string,any>[];
    if( !Array.isArray(transcript) )
        return undefined;
    for( const entry of transcript ) {
        const toolCalls = entry.tool_calls as Record<string,any>[];
        if( !Array.isArray(toolCalls) )
            continue;
        const emailToolCall = toolCalls.find( tc => tc.tool_name === 'sendEmail' );
        if( emailToolCall && (emailToolCall.tool_has_been_called??true) ) {
            const params = emailToolCall.params_as_json;
            return (typeof params === 'string') ? misc.jsonParse(params,undefined) : params;
        }
    }
    return undefined;
}
const guessState = ( phoneNumber:string ) : string => {
    // Guess the state from the phone number
    const re = /^(\+1)?(\d{3})\d{7}/;
    const match = phoneNumber.match(re);
    if( !match )
        return 'unknown';
    return stateByAreaCode[match[2]] || 'unknown';
}
export default () => {
    const router   = express.Router();
    router.post('/tool/sendEmail',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
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
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
                throw Error(`Access denied`);
            const { name } = req.body as Record<string,any>;
            const phoneNumber =  server.config.simulatedPhoneNumber || req.body.phoneNumber as string;
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
                `ask the user ${vmPrompt}, save its answer to a text and call sendEmail to ${contact.emailAddresses[0]} with subject "Call to ${contact.name} from ${phoneNumber ||'n/a'}" and that text` :
                `ask user to confirm that the user wants to talk to '${canonicalName}'. If user confirms, then call redirectCall with +1${contact.phoneNumbers[0]}. Otherwise ask user again the user wants to speak to.`;
            server.module_log(module.filename,2,`Handled 'dispatchCall'`,{ name },result);
            return result;
        });
    });
    router.post('/tool/guessState',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
                throw Error(`Access denied`);
            const { phoneNumber } = req.body as Record<string,any>;
            if( !phoneNumber )
                throw Error(`Invalid arguments`);
            return guessState(phoneNumber);
        });
    });
    router.post('/tool/getUserByPhone',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
                throw Error(`Access denied`);
            const phoneNumber = req.body.phoneNumber as string;
            if( !phoneNumber )
                throw Error(`Invalid phone number`);
            const sessionId = req.body.sessionId as string;
            if ( !sessionId )
                throw Error(`Invalid session ID`);
            return VapeApi.getUserByPhone(sessionId, phoneNumber);
        });
    });
    router.post('/tool/dispatchUserByPhone',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
                throw Error(`Access denied`);
            const phoneNumber = server.config.simulatedPhoneNumber || (req.body.phoneNumber as string);
            if( !phoneNumber )
                throw Error(`Invalid phone number`);
            const sessionId = (req.body.sessionId as string);
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
        const sessionId = req.body.sessionId as string || 'unknown_session';
        return sendResponse(req,res,async () => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
                throw Error(`Access denied`);
            const question = req.body.question as string;
            if( !question )
                throw Error(`Invalid arguments`);
            return VapeApi.getFAQAnswer(sessionId ,question);
        });
    });
    router.post('/summary',express.text({type:'application/json'}),(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,async () => {
            const body_str = req.body;
            if( typeof body_str !== 'string' )
                throw Error(`Unexpected type of the body ${typeof body_str}`);
            const body_obj = JSON.parse(body_str);
            if( body_obj.type==='post_call_transcription' ) {

                // following the example on
                // https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks
                // HMAC validation of elevenlabs secret is used instead of header secret, since elevenlabs does not allow custom headers
                const signature = req.header('ElevenLabs-Signature');
                const secret    = server.config.elevenLabs!.summarySecret;
                const event = await (new ElevenLabsApi()).webhooks.constructEvent(
                    body_str,
                    signature,
                    secret
                );
                // The customer requests an email to be sent to the customer if the call is transferred to a number
                // First try the easy way
                const serverMessage  = event.data as Record<string,any>;
                server.module_log(module.filename,2,`Got assistant '${serverMessage.agent_name}' notification '${body_obj.type}'`,{
                    status          : serverMessage.status,
                    summary         : serverMessage.analysis.transcript_summary,
                    agentsName      : serverMessage.agent_name,
                });
                if( getEmailToolCall(serverMessage)?.to === server.config.notificationEmailAddress ) {
                    server.module_log(module.filename,2,`Summary email already sent to '${server.config.notificationEmailAddress}'`);
                }
                else {
                    const emailText = `Call summary: ${serverMessage.analysis.transcript_summary}`;
                    server.sendEmail({
                        to      :   server.config.notificationEmailAddress,
                        subject :   `Call to ${serverMessage.agent_name} with status ${serverMessage.status}`,
                        text    :   emailText
                    }).then(() => {
                        server.module_log(module.filename,2,`Sent email with call summary '${emailText}' to '${server.config.notificationEmailAddress}'`);
                    }).catch( err => {
                        server.module_log(module.filename,1,`Cannot send an email with call summary '${emailText}' to '${server.config.notificationEmailAddress}' (${err.message})`);
                    });
                }
            }
        });
    });
    router.post('/cmd',(req:expressCore.Request,res:expressCore.Response) => {
        return sendResponse(req,res,() => {
            if( req.get(server.config.web.header_name)!==server.config.provider.toolSecret )
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
