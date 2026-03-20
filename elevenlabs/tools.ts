import { ElevenLabs }       from '@elevenlabs/elevenlabs-js';

import * as elevenLabsConsts  from './consts';
import * as Config          from '../Config';
import * as Contacts        from '../Contacts';
import { server }           from '../Server';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const getWebhookHeaders = () : Record<string,string> => {
    const config = Config.get();
    return {
        "X-Secret" : config.elevenLabsToolSecret,
    };
};

const getToolUrl = ( toolName:string ) : string => {
    const config = Config.get();
    return `https://demo.tectransit.com/elevenlabs`;
};

// ---------------------------------------------------------------------------
// Webhook tools  (server-side function calls)
// ---------------------------------------------------------------------------

/**
 * dispatchCall – look up a contact by name, check time-zone / business hours
 * and return dispatch instructions.
 */
export const getDispatchCall = ( contacts:Contacts.Contact[] ) : ElevenLabs.ToolRequestModel => {
    return {
        toolConfig : {
            type        : "webhook",
            name        : "dispatchCall",
            description : "API gets a person name, looks up spreadsheet contacts, checks current time and return instructions how to dispatch the call",
            responseTimeoutSecs : 30,
            apiSchema : {
                url     : getToolUrl("dispatchCall"),
                method  : "POST",
                requestHeaders  : getWebhookHeaders(),
                requestBodySchema : {
                    type        : "object",
                    properties  : {
                        name : {
                            type        : "string",
                            description : "The name of the person to dispatch the call to",
                            enum        : contacts.map(c => c.name),
                        }
                    },
                    required : ["name"]
                }
            }
        }
    };
};

/**
 * sendEmail – send an email to one of the known contacts.
 */
export const getSendEmail = ( contacts:Contacts.Contact[] ) : ElevenLabs.ToolRequestModel => {
    const toEnums : string[] = [];
    contacts.forEach( c => {
        if( c.emailAddresses[0] && !toEnums.includes(c.emailAddresses[0]) )
            toEnums.push(c.emailAddresses[0]);
    });
    return {
        toolConfig : {
            type        : "webhook",
            name        : "sendEmail",
            description : "Sending Email",
            responseTimeoutSecs : 30,
            apiSchema : {
                url     : getToolUrl("sendEmail"),
                method  : "POST",
                requestHeaders  : getWebhookHeaders(),
                requestBodySchema : {
                    type        : "object",
                    properties  : {
                        to : {
                            type        : "string",
                            description : "The email address",
                            enum        : toEnums,
                        },
                        text : {
                            type        : "string",
                            description : "The body of the email",
                        },
                        subject : {
                            type        : "string",
                            description : "The subject of the email",
                        }
                    },
                    required : ["to","text","subject"]
                }
            }
        }
    };
};

/**
 * guessState – attempt to determine the US state of the caller.
 */
export const getGuessState = ( /*contacts:Contacts.Contact[]*/ ) : ElevenLabs.ToolRequestModel => {
    return {
        toolConfig : {
            type        : "webhook",
            name        : "guessState",
            description : "Guess State of the Caller",
            responseTimeoutSecs : 30,
            apiSchema : {
                url     : getToolUrl("guessState"),
                method  : "POST",
                requestHeaders  : getWebhookHeaders(),
                requestBodySchema : {
                    type        : "object",
                    properties  : {
                        callerId: {
                            type            : "string",
                            dynamicVariable : "system__caller_id",
                        }
                    },
                    required : ["callerId"]
                },
            }
        }
    };
};

/**
 * getUserByPhone – retrieve user information based on caller phone number.
 */
export const getUserByPhone = ( contacts:Contacts.Contact[] ) : ElevenLabs.ToolRequestModel => {
    return {
        toolConfig : {
            type        : "webhook",
            name        : "getUserByPhone",
            description : "Get user information from phone number",
            responseTimeoutSecs : 30,
            apiSchema : {
                url     : getToolUrl("getUserByPhone"),
                method  : "POST",
                requestHeaders  : getWebhookHeaders(),
                requestBodySchema : {
                    type        : "object",
                    properties  : {
                        sessionId : {
                            type            : "string",
                            dynamicVariable : "system__conversation_id",
                        },
                        phoneNumber : {
                            type        : "string",
                            dynamicVariable : "system__caller_id",
                        }
                    },
                    required : ["sessionId", "phoneNumber"]
                }
            }
        }
    };
};

/**
 * dispatchUserByPhone – same as getUserByPhone but the server also returns
 * the next "instructions" so the assistant can proceed without waiting for
 * user input.
 */
export const dispatchUserByPhone = ( contacts:Contacts.Contact[] ) : ElevenLabs.ToolRequestModel => {
    const tmp = getUserByPhone(contacts);
    const cfg = tmp.toolConfig as ElevenLabs.WebhookToolConfigInput & { type:"webhook" };
    cfg.name        = "dispatchUserByPhone";
    cfg.description = "Dispatch user call by user phone number";
    cfg.apiSchema.url = getToolUrl("dispatchUserByPhone");
    return tmp;
};

/**
 * getFAQAnswer – retrieve an FAQ answer for a question.
 */
export const getFAQAnswer = ( contacts:Contacts.Contact[] ) : ElevenLabs.ToolRequestModel => {
    return {
        toolConfig : {
            type        : "webhook",
            name        : "getFAQAnswer",
            description : "Get FAQ answer for the question",
            responseTimeoutSecs : 30,
            apiSchema : {
                url     : getToolUrl("getFAQAnswer"),
                method  : "POST",
                requestHeaders  : getWebhookHeaders(),
                requestBodySchema : {
                    type        : "object",
                    properties  : {
                        question : {
                            type        : "string",
                            description : "The question asked by the caller",
                        },
                        sessionId: {
                            type            : "string",
                            dynamicVariable : "system__conversation_id",
                        }

                    },
                    required : ["question", "sessionId"]
                }
            }
        }
    };
};

// ---------------------------------------------------------------------------
// System tools  (transfer / handoff)
// ---------------------------------------------------------------------------

/**
 * redirectCall – transfer the call to a phone number (group extension or
 * individual contact).
 *
 * Maps from the Vapi `transferCall` tool type to ElevenLabs `transfer_to_number`
 * system tool.
 */
export const getTransferToNumber = ( contacts:Contacts.Contact[] ) : ElevenLabs.SystemToolConfigOutput => {
    const transfers : ElevenLabs.PhoneNumberTransfer[] = [];

    // Group extensions
    Object.entries(elevenLabsConsts.groupExtensions).forEach( ([name,number]) => {
        if( !transfers.some(t => t.phoneNumber === number) ) {
            transfers.push({
                phoneNumber     : number,
                condition       : `Transfer the call when the caller needs ${name}`,
                transferType    : "blind",
            });
        } else {
            server.log(1,`Transfer destination already exists`,{name,number});
        }
    });

    // Contacts
    contacts.forEach( c => {
        const fullPhone = `+1${c.phoneNumbers[0]}`;
        if( !transfers.some(t => t.phoneNumber === fullPhone) ) {
            transfers.push({
                phoneNumber     : fullPhone,
                condition       : c.description
                    ? `Transfer the call to ${c.name} - ${c.description}`
                    : `Transfer the call to ${c.name}`,
                transferType    : "conference",
            });
        } else {
            server.log(1,`Transfer destination already exists`,c);
        }
    });

    return {
        type        : "system",
        name        : "transfer_to_number",
        description : "Use this function to transfer the call to various contacts across different departments",
        params : {
            systemToolType : "transfer_to_number",
            transfers,
        }
    };
};

/**
 * handoffToAssistant – hand the conversation off to another ElevenLabs agent.
 *
 * Maps from the Vapi `handoff` tool type to ElevenLabs `transfer_to_agent`
 * system tool.
 *
 * @param agents - array of {name, id} for every agent the current agent can
 *                 hand off to.  `id` must be the ElevenLabs agent id.
 */
export const getTransferToAgent = ( agents:{name:string, id:string}[] ) : ElevenLabs.SystemToolConfigOutput => {
    const transfers : ElevenLabs.AgentTransfer[] = agents.map( a => ({
        agentId     : a.id,
        condition   : `Transfer the call to the ${a.name} assistant`,
    }));
    return {
        type        : "system",
        name        : "transfer_to_agent",
        description : "Hand off the conversation to another assistant",
        params : {
            systemToolType : "transfer_to_agent",
            transfers,
        }
    };
};


