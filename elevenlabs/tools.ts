import { ElevenLabs }       from '@elevenlabs/elevenlabs-js';

import * as elevenLabsConsts  from './consts';
import * as Config          from '../Config';
import * as Contacts        from '../Contacts';
import { server }           from '../Server';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const getWebhookHeaders = () : Record<string,string> => {
    return {
        "X-Secret" : server.config.provider.toolSecret,
    };
};

const getToolUrl = ( toolName:string ) : string => {
    return `${server.config.publicUrl}/tool/${toolName}`;
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
                        },
                        phoneNumber: {
                            type            : "string",
                            dynamicVariable : "system__caller_id",
                        }
                    },
                    required : ["name","phoneNumber"]
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
                        type : {
                            type        : "string",
                            constantValue : "sendEmail",
                        },
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
                    required : ["type","to","text","subject"]
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
                        phoneNumber: {
                            type            : "string",
                            dynamicVariable : "system__caller_id",
                        }
                    },
                    required : ["phoneNumber"]
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

