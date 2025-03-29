import {
    Vapi
}                       from '@vapi-ai/server-sdk';

import * as Config      from './Config';
import * as Contacts    from './Contacts';

export const getDispatchCallTool = ( contacts:Contacts.Contact[] ) : Vapi.CreateFunctionToolDto => {
    const config = Config.get();
    const result =  {
        'type'     : 'function',
        'async'    : false,
        'function' : {
            name        : 'dispatchCall',
            description : "API gets a person name, looks up spreadsheet contacts, checks current time and return instructions how to dispatch the call",
            parameters  : {
                'type' : 'object',
                properties : {
                    name : {
                        type        : 'string',
                        description : 'The name of the person to dispatch the call to',
                        'enum'      : contacts.map(c=>c.name)
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
            ...contacts.map( c => {
                return {
                    // https://docs.vapi.ai/api-reference/tools/create#request.body.function.messages.request-complete.role
                    "type"      : "request-start",
                    "content"   : `Dispatching your call to ${c.name}`,
                    conditions  : [{
                        param   : 'name',
                        operator: 'eq', 
                        value   : c.name as unknown as Record<string,unknown>
                    }]
                } as Vapi.ToolMessageStart;
            }),
            {
                "role"   : "system",
                "type"   : "request-complete",
                "content": "."
            },
            {
                "type": "request-failed",
                "content": "Cannot dispatch call"
            }
        ] as Vapi.CreateFunctionToolDtoMessagesItem[],
        server : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateFunctionToolDto;
    return result;
}

export const getRedirectCallTool = ( contacts:Contacts.Contact[] ) : Vapi.CreateTransferCallToolDto => {
    const config = Config.get();
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
                    },
                },
                required    : [
                    "destination"
                ]
            },
        },
        messages        : [] as Vapi.ToolMessageStart[],
        server : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateTransferCallToolDto;
    const destinationEnums  = tool['function']!.parameters!.properties!.destination!.enum!;
    contacts.forEach( c => {
        // TODO:
        // The same phone number can be listed in the contacts multiple times
        // In this case VAPI will produce the _first_ message in `messages` array
        // that match the phone number. If a specific message needs to be listed
        // then the contact for this message needs to be listed first in the Contacts
        // spreadsheet
        const fullPhone     = `+1${c.phoneNumbers[0]}`;
        if( !destinationEnums.includes(fullPhone) )
            destinationEnums.push(fullPhone);
        tool.destinations!.push({
            'type'      :   'number',
            number      :   fullPhone,
            //message     :   `I am forwarding your call to ${c.name}. Please stay on the line`,
            description :   c.description ? `${c.name} - ${c.description}` : c.name,
            callerId    :   `+17254446330`,
            transferPlan : {
                mode        : 'warm-transfer-say-message',
                message     : 'Incoming call from Intempus',
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
        /*
        tool.messages!.push({
            'type'      : 'request-start',
            content     : `I am forwarding your call to ${c.name}. Please stay on the line`,
            conditions  : [{
                param   : 'name',
                operator: 'eq',
                value   : c.name as unknown as Record<string,unknown>
            }]
        } as Vapi.CreateTransferCallToolDtoMessagesItem);
        */
    });
    // In case if the call is forwarded to unknown contact
    /*
    tool.messages!.push({
        'type'      : 'request-start',
        content     : `I am forwarding your call...`,
    });
    */
    return tool as Vapi.CreateTransferCallToolDto;
}

export const getSendEmailTool = ( contacts:Contacts.Contact[] ) : Vapi.CreateFunctionToolDto => {
    const config    = Config.get();
    const toArgName = 'to';
    const tool = {
        'type'      : "function",
        "async"     : false,
        'function'  : {
            "name"          : "sendEmail",
            "description"   : "Sending Email",
            "parameters"    : {
                "type"      :"object",
                properties  : {
                    [toArgName]    : {
                        "type"      :"string",
                        description : 'The email address',
                        'enum'      : [] as string[],
                    },
                    "text"  : {
                        "type"      : "string"
                    },
                    "subject": {
                        "type"      : "string"
                    },
                },
                required: [
                    toArgName,
                    "text",
                    "subject"
                ]
            }
        },
        messages    :[
            {
                "type"      : "request-response-delayed",
                "content"   : "Sending email is taking a bit longer to respond"
            },
            {
                "role"      : "system",
                "type"      : "request-complete",
                "content"   : "Hangup"
            },
            {
                "type"      : "request-failed",
                "content"   : "Cannot send email"
            }
        ],
        server  : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateFunctionToolDto;
    const toEnums  = tool['function']!.parameters!.properties![toArgName]!.enum;
    contacts.forEach( c => {
        // TODO:
        // The same phone number can be listed in the contacts multiple times
        // In this case VAPI will produce the _first_ message in `messages` array
        // that match the phone number. If a specific message needs to be listed
        // then the contact for this message needs to be listed first in the Contacts
        // spreadsheet
        if( !c.emailAddresses[0] )
            return;
        if( toEnums && !toEnums.includes(c.emailAddresses[0]) )
            toEnums.push(c.emailAddresses[0]);
        /*
        tool.messages!.push({
            'type'      : 'request-start',
            content     : `I am sending email to ${c.name}. Please stay on the line`,
            conditions  : [{
                param   : 'name',
                operator: 'eq',
                value   : c.name as unknown as Record<string,unknown>
            }]
        } as Vapi.CreateTransferCallToolDtoMessagesItem);
        */
    });

    return tool;
}

export const getAssistant = (
    contacts            : Contacts.Contact[],
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ToolsListResponseItem[]
 ) : Vapi.CreateAssistantDto => {

    const config = Config.get();

    // let's look at existing assistant
    const firstSystemMessageContent = existingAssistant?.model?.messages?.find( m => {
        return m.role==='system'
    })?.content;
    const systemPromptHeader = firstSystemMessageContent?.split(/without\s+spelling\s+them\./i)?.at(0) ||
        `You are an AI voice bot representing **Intempus Realty**. Your role is to assist callers promptly, efficiently, and courteously with their inquiries. You will handle a variety of requests, including rental property questions, property management services, H-O-A services, maintenance requests, billing issues, lockouts, call transfers, and emailing. You will also request or clarify geographic information when relevant (e.g., Santa Clara County, Alameda, Contra Costa).

Geographic Service Area Restriction:
- Intempus Realty only provides services in California, Indiana, Florida, Nevada, South Carolina, Georgia, Ohio, and Tennessee.
- If the caller request involves a location outside of these states, politely inform them that Intempus Realty only operates in specific states and politely end the call.
End the call immediately after delivering this message.
- If the caller asks for H-O-A then clarify which state they are referring to. If the state is California, then act as if the caller asks for California H-O-A. If the state is Florida then act as if the caller asks for Florida H-O-A. Otherwise act as if the caller asks for "General H-O-A".
- If the caller asks for Property Management then clarify which state they are referring to. If the state is California or Indiana, then act as if the caller asks for "Property Management for CA,IN". Otherwise act as if the caller asks for "Property Management for TN,GA,SC,OH,FL".
- If the caller asks for Leasing then clarify which state they are referring to. If the state is Indiana, then act as if the caller asks for "Leasing for Indiana". For any other state, including California, act as if the caller asks for "Leasing Inquiries".
- If the caller asks for Maintenance then clarify if the caller is referring to state of Indiana. If so then act as if the caller asks for "Maintenance for Indiana". For any other state, including California, clarify if the caller has an urgent maintenance issue. If so then act as if the caller asks for "urgent maintenance issues". Otherwise act as if the caller asks for "non-urgent maintenance issues".

General Guidelines:
- Always listen to the caller needs.
- Be polite, professional, and efficient at all times.
- If the caller's requested department or service is unclear, ask for clarification by offering the list of available departments.
- If a transfer or email cannot be completed after attempts to clarify, end the call politely.
- Always prioritize the caller's needs and attempt to resolve their inquiry before ending the call.

Error Handling:
- If the customer's words or intend is unclear, ask clarifying questions. If you encounter any issues, inform the customer politely and ask to repeat.

Pronunciation Directive:
- Always pronounce names of people and departments (other than H-O-A) directly without spelling them.`;

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
        name        : config.assistantName,
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
                    "content": `${systemPromptHeader}without spelling them.

To send test email, ask who is asking and what is the reason. after getting the answer, call sendEmail to destination constfilin@gmail.com with subject "user call" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.

If necessary, provide an option to email a billing specialist or transfer during business hours (following the validation steps below).
Once the location is confirmed, follow location-based procedures. If a transfer or email is required, apply the validation and time-based rules as above.

`
                }
            ],
            "provider"      : "openai",
            "maxTokens"     : 300,
            "temperature"   : 0.3,
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
            "model"     : "nova-2-phonecall",
            "keywords"  : Object.values(contacts
                .map(c=>c.name.split(/\s+/))
                .flat()
                .reduce((acc,n) => {
                    // Remove anything that is not a letter
                    n = n.replace(/[^a-zA-Z]/g,'');
                    // throw out the common words
                    const lower = n.toLowerCase();
                    if( ["a","an","the","for","to","oncall","in","by","of","main","hoa"].includes(lower) )
                        return acc;
                    // Remove anything that is not a letter
                    acc[lower] = n;
                    return acc;
                },{
                    "voice"     : "voice",
                    "Intempus"  : "Intempus",
                    "Realty"    : "Realty",
                    "Bot"       : "Bot",
                } as Record<string,string>)).map(n=>`${n}:10`),
            "language"      : "en",
            "provider"      : "deepgram",
            "smartFormat"   : true
        },
        clientMessages  : [
        //    "conversation-update",
        //    "function-call"
        ],
        serverMessages  : [
            //'conversation-update',
            'end-of-call-report',
            'function-call',
            'hang',
            //'model-output',
            'phone-call-control',
            //'speech-update',
            //'status-update',
            //'transcript',
            //'transcript[transcriptType="final"]',
            'tool-calls',
            'transfer-destination-request',
            'user-interrupted',
            //'voice-input'        
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
            "url"            : `${config.publicUrl}/assistant`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }
        }
    } as Vapi.CreateAssistantDto;

    assistant.model!.messages![0].content += contacts
        .map( c => {
            return `If the user asks for ${c.name}, call dispatchCall with ${c.name}, wait for result and immediately follow the instructions of the result.`;
        })
        .join("\n");
    console.log(assistant);
    return assistant;
}

export const getToolByName = async (
    name    : string
) : Promise<Vapi.ToolsCreateRequest> => {
    switch( name ) {
    case 'redirectCall':
        return getRedirectCallTool(await Contacts.get());
    case 'dispatchCall':
        return getDispatchCallTool(await Contacts.get());
    case 'sendEmail':
        return getSendEmailTool(await Contacts.get());
    }
    throw Error(`Tool '${name}' s not known`);
}

export const getAssistantByName = async (
    name                : string,
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ToolsListResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    const config = Config.get();
    if( name===config.assistantName )
        return getAssistant(await Contacts.get(),existingAssistant,existingTools);
    throw Error(`Assistant '${name}' s not known`);
}
