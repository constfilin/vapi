import * as GoogleSpreadsheet   from 'google-spreadsheet';
import {
    Vapi
}                   from '@vapi-ai/server-sdk';

import * as consts  from './consts';
import * as misc    from './misc';

export const getRedirectCallTool = ( contacts:misc.Contact[] ) : Vapi.CreateTransferCallToolDto => {
    const tool = {
        type            : "transferCall",
        async           : false,
        destinations    : [] as Vapi.TransferDestinationNumber[],
        'function'      : {
            name        : "redirectCall",
            description : "Use this function to transfer the call to various contacts across different departments",
            parameters      : {
                type        : "object",
                properties  : {
                    destination : {
                        type        : 'string',
                        description : 'The destination phone number for the call transfer',
                        'enum'      : [] as string[],
                    }
                },
                required    : [
                    "destination"
                ]
            },
        },
        messages        : [] as Vapi.ToolMessageStart[],
        server : {
            "url"            : "https://demo.tectransit.com/api/vapi/tool",
            "timeoutSeconds" : 30,
            "secret"         : consts.vapiToolSecret
        }
    };
    contacts.forEach( c => {
        tool.destinations.push({
            'type'      :   'number',
            number      :   `+1${c.phoneNumbers[0]}`,
            message     :   `I am forwarding your call to ${c.name}. Please stay on the line`,
            description :   c.description ? `${c.name} - ${c.description}` : c.name,
            callerId    :   `+17254446330`,
            transferPlan : {
                mode        : 'warm-transfer-wait-for-operator-to-speak-first-and-then-say-message',
                //sipVerb     : 'refer',
                summaryPlan : {
                    enabled : true,
                    messages : [
                        {
                            role    : "system",
                            content : "Please provide a summary of the call"
                        },
                        {
                            role    : "user",
                            content : "Here is the transcript: {{transcript}} "
                        }

                    ]
                }
            }
        } as Vapi.TransferDestinationNumber);
        // TODO:
        // The same phone number can be listed in the contacts multiple times
        // In this case VAPI will produce the _first_ message in `messages` array
        // that match the phone number. If a specific message needs to be listed
        // then the contact for this message needs to be listed first in the Contacts
        // spreadsheet
        const fullPhone     = `+1${c.phoneNumbers[0]}`;
        const theFunction   = tool['function']!;
        if( !theFunction.parameters!.properties!.destination!.enum!.includes(fullPhone) )
            theFunction.parameters!.properties!.destination!.enum!.push(fullPhone);
        tool.messages!.push({
            'type'      : 'request-start',
            content     : `I am forwarding your call to ${c.name}. Please stay on the line`,
            conditions  : [{
                param   : 'destination',
                operator: 'eq',
                // @ts-expect-error
                value   : fullPhone
            }]
        });
    });
    // In case if the call is forwarded to unknown contact
    tool.messages!.push({
        'type'      : 'request-start',
        content     : `I am forwarding your call...`,
    });
    return tool as Vapi.CreateTransferCallToolDto;
}

export const getDispatchCallTool = () : Vapi.CreateFunctionToolDto => {
    return {
        'type'     : 'function',
        'async'     : false,
        'function' : {
            name        : 'dispatchCall',
            description : "API gets a person name, looks up spreadsheet contacts, checks current time and return instructions how to dispatch the call",
            parameters  : {
                'type' : 'object',
                properties : {
                    name : {
                        'type' : 'string'
                    }
                },
                required : [
                    "name"
                ]
            }
        },
        messages : [
            {
                "type": "request-response-delayed",
                "content": "Dispatching call is taking a bit longer"
            },
            {
                "role": "system",
                "type": "request-complete",
                "content": "."
            },
            {
                "type": "request-failed",
                "content": "Cannot dispatch call"
            }
        ],
        server : {
            "url"            : "https://demo.tectransit.com/api/vapi/tool",
            "timeoutSeconds" : 30,
            "secret"         : consts.vapiToolSecret
        }
    }
}

export const getSendEmailTool = () : Vapi.CreateFunctionToolDto => {
    const tool = {
        'type'      : "function",
        "async"     : false,
        'function'  : {
            "name"          : "sendEmail",
            "description"   : "Sending Email",
            "parameters"    : {
                "type"      :"object",
                properties  : {
                    "to":{
                        "type":"string"
                    },
                    "text":{
                        "type":"string"
                    },
                    "subject":{
                        "type":"string"
                    },
                },
                required: [
                    "to",
                    "text",
                    "subject"
                ]
            }
        },
        messages    :[
            {
                "type":"request-response-delayed",
                "content":"Sending email is taking a bit longer to respond"
            },
            {
                "role":"assistant",
                "type":"request-complete",
                "content":"."
            },
            {
                "type":"request-failed",
                "content":"Cannot send email"
            }
        ],
        server  : {
            "url"            : "https://demo.tectransit.com/api/vapi/tool",
            "timeoutSeconds" : 30,
            "secret"         : consts.vapiToolSecret
        }
    };
    return tool as Vapi.CreateFunctionToolDto;
}

export const getAssistant = (
    contacts            : misc.Contact[],
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ToolsListResponseItem[]
 ) : Vapi.CreateAssistantDto => {

    // let's look at existing assistant
    const firstSystemMessageContent = existingAssistant?.model?.messages?.find( m => {
        return m.role==='system'
    })?.content;
    const systemPromptHeader = firstSystemMessageContent?.split(/Ensure.+conversational\s+tone\./)?.at(0) ||
        `You are an AI voice bot representing **Intempus Realty**. Your role is to assist callers promptly, efficiently, and courteously with their inquiries. You will handle a variety of requests, including rental property questions, property management services, HOA services, maintenance requests, billing issues, lockouts, call transfers, and emailing. You will also request or clarify geographic information when relevant (e.g., Santa Clara County, Alameda, Contra Costa).

General Guidelines:
- always listen to the caller needs.
- Be polite, professional, and efficient at all times.
- If the caller's requested department or service is unclear, ask for clarification by offering the list of available departments.
- If a transfer or email cannot be completed after attempts to clarify, end the call politely.
- Always prioritize the caller's needs and attempt to resolve their inquiry before ending the call.

Pronunciation Directive:
- Always pronounce names of people and departments directly without spelling them.`;

    // let's look at existing tools
    const toolsByName = existingTools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ToolsListResponseItem>);
    const missingToolName = ['redirectCall','sendEmail','dispatchCall'].find(n=>!(n in toolsByName));
    if( missingToolName )
        throw Error(`Cannot find tool '${missingToolName}'`);
    const redirectCallTool  = toolsByName['redirectCall']!;
    const sendEmailTool     = toolsByName['sendEmail']!;
    const dispatchCallTool  = toolsByName['dispatchCall']!;
    const assistant         = {
        name        : consts.assistantName,
        voice       : {
            "voiceId"               : "luna",
            "provider"              : "deepgram",
            "fillerInjectionEnabled": false,
            "inputPunctuationBoundaries": [
                "."
            ]
        },
        voicemailDetection: {
            provider: "twilio",
            enabled : true,
            voicemailDetectionTypes: [
              "machine_start",
              "machine_end_beep",
              "unknown"
            ],
            machineDetectionTimeout: 15
        },
        // Note:
        // This seems to be ineffective
        voicemailMessage : "Call is going to voicemail",
        model       : {
            "model": "gpt-4o-mini",
            "toolIds": [
                redirectCallTool.id,
                sendEmailTool.id,
                dispatchCallTool.id
            ],
            "messages": [
                {
                    "role"   : "system",
                    "content": `${systemPromptHeader}Ensure proper pronunciation to maintain a natural conversational tone.

To send test email, ask who is asking and what is the reason. after getting the answer, call sendEmail to destination constfilin@gmail.com with subject "user call" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.

If necessary, provide an option to email a billing specialist or transfer during business hours (following the validation steps below).
Once the location is confirmed, follow location-based procedures. If a transfer or email is required, apply the validation and time-based rules as above.

If the user has property management or HOA inquiries use the redirectCall with +14155553921.
If the user has urgent maintenance issues call redirectCall with +12065557845.
If the user has non-urgent maintenance issues clarify the issue then call redirectCall with +16465552347.
If the user has billing inquiries call redirectCall with +13055556712.
If the user has leasing  inquiries call redirectCall with +14083339356.

`
                }
            ],
            "provider"      : "openai",
            "maxTokens"     : 300,
            "temperature"   : 0.7,
            "tools"         : [
                // TODO:
                // This set of tools allows registrations of tool callbacks _immediately_ with registration
                // of the assistant. The type of the entries in `tools` array is `Vapi.OpenAiModelToolsItem`
                // We just need to fill this array out
                {
                    async : false,
                    type  : "voicemail"
                }
            ]
        },
        recordingEnabled        : true,
        firstMessage            : "Hello, this is Intempus Realty voice answering system. How may I assist you today?",
        endCallFunctionEnabled  : true,
        endCallMessage          : "Thank you for contacting us. Have a great day!",
        transcriber             : {
            "model"     : "nova-2",
            "keywords"  : Object.values(contacts
                .map(c=>c.name.split(/\s+/))
                .flat()
                .reduce((acc,n) => {
                    // Remove anything that is not a letter
                    n = n.replace(/[^a-zA-Z]/g,'');
                    // throw out the common words
                    const lower = n.toLowerCase();
                    if( ["a","an","the","for","to","oncall","by","of","main"].includes(lower) )
                        return acc;
                    // Remove anything that is not a letter
                    acc[lower] = n;
                    return acc;
                },{} as Record<string,string>)).map(n=>`${n}:30`),
            "language"      : "en",
            "provider"      : "deepgram",
            "smartFormat"   : true
        },
        clientMessages  : [
        //    "conversation-update",
        //    "function-call"
        ],
        serverMessages  : [
            "hang",
            //"model-output",
            "tool-calls",
            "transfer-destination-request",
            "transfer-update",
            "end-of-call-report"
        ],
        endCallPhrases  : [
            "goodbye"
        ],
        backchannelingEnabled: false,
        backgroundDenoisingEnabled: false,
        startSpeakingPlan: {
            "smartEndpointingEnabled": true
        },
        server  : {
            "url"            : "https://demo.tectransit.com/api/vapi/assistant",
            "timeoutSeconds" : 30,
            "secret"         : consts.vapiToolSecret
        }
    } as Vapi.CreateAssistantDto;

    assistant.model!.messages![0].content += contacts
        .map( c => {
            return `If the user asks for ${c.name}, call dispatchCall with ${c.name}, wait for result and immediately follow the instructions of the result.`;
        })
        .join("\n");

    return assistant;
}

export const getToolByName = async (
    name    : string
) : Promise<Vapi.ToolsCreateRequest> => {
    switch( name ) {
    case 'redirectCall':
        return getRedirectCallTool(await misc.getCachedContacts());
    case 'dispatchCall':
        return getDispatchCallTool();
    case 'sendEmail':
        return getSendEmailTool();
    }
    throw Error(`Tool '${name}' s not known`);
}

export const getAssistantByName = async (
    name                : string,
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ToolsListResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    if( name===consts.assistantName )
        return getAssistant(await misc.getCachedContacts(),existingAssistant,existingTools);
    throw Error(`Assistant '${name}' s not known`);
}