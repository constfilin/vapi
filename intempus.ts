import * as GoogleSpreadsheet   from 'google-spreadsheet';
import {
    Vapi
}                   from '@vapi-ai/server-sdk';

import * as consts  from './consts';
import * as misc    from './misc';

export const getRedirectCallTool = ( contacts:misc.Contact[] ) : Vapi.CreateFunctionToolDto => {
    return contacts.reduce((acc,c,ndx) => {
        // @ts-expect-error
        acc.destinations.push({
            'type'      :   'number',
            number      :   `+1${c.phoneNumbers[0]}`,
            message     :   `I am forwarding your call to ${c.name}. Please stay on the line`,
            description :   c.description ? `${c.name} - ${c.description}` : c.name,
            transferPlan : {
                mode        : 'warm-transfer-say-summary',
                sipVerb     : 'refer',
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
        });
        // TODO:
        // Make the phone unique
        const fullPhone     = `+1${c.phoneNumbers[0]}`;
        const theFunction   = acc['function']!;
        if( !theFunction.parameters!.properties!.destination!.enum!.includes(fullPhone) )
            theFunction.parameters!.properties!.destination!.enum!.push(fullPhone);
        acc.messages!.push({
            'type'      : 'request-start',
            content     : `I am forwarding your call to ${c.name}. Please stay on the line`,
            conditions  : [{
                param   : 'destination',
                operator: 'eq',
                // @ts-expect-error
                value   : fullPhone
            }]
        });
        return acc;
    },{
        type            : "transferCall" as "function", // This is a typescript hack
        async           : false,
        destinations    : [],
        'function'      : {
            name        : "redirectCall",
            description : "Use this function to transfer the call to various contacts across different departments",
            parameters      : {
                type        : "object",
                properties  : {
                    destination : {
                        type        : 'string',
                        description : 'The destination phone number for the call transfer',
                        'enum'      : [],
                    }
                },
                required    : [
                    "destination"
                ]
            },
        },
        messages        : [],
    } as Vapi.CreateFunctionToolDto);
}

export const getAssistant = ( 
    contacts: misc.Contact[],
    tools   : Vapi.ToolsListResponseItem[]
 ) : Vapi.CreateAssistantDto => {
    const toolsByName = tools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ToolsListResponseItem>);    
    const missingToolName = ['redirectCall','sendEmail','dispatchCall'].find(n=>!(n in toolsByName));
    if( missingToolName )
        throw Error(`Cannot find tool '${missingToolName}'`);
    const redirectCallTool  = toolsByName['redirectCall']!;
    const sendEmailTool     = toolsByName['sendEmail']!;
    const dispatchCallTool  = toolsByName['dispatchCall']!;
    return contacts.reduce((acc,c,ndx) => {
        acc.model!.messages![0].content += `If the user asks for ${c.name}, call combinedTransferCall with +1${c.phoneNumbers[0]}\n`;
        return acc;
    },{
            name        : consts.assistantName,
            voice       : {
                "voiceId"               : "luna",
                "provider"              : "deepgram",
                "fillerInjectionEnabled": false,
                "inputPunctuationBoundaries": [
                    "."
                ]
            },
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
                        "content": `You are an AI voice bot representing **Intempus Realty**. Your role is to assist callers promptly, efficiently, and courteously with their inquiries. You will handle a variety of requests, including rental property questions, property management services, HOA services, maintenance requests, billing issues, lockouts, call transfers, and emailing. You will also request or clarify geographic information when relevant (e.g., Santa Clara County, Alameda, Contra Costa).

General Guidelines:
    - always listen to the caller needs.
    - Be polite, professional, and efficient at all times.  
    - If the caller's requested department or service is unclear, ask for clarification by offering the list of available departments.  
    - If a transfer or email cannot be completed after attempts to clarify, end the call politely.  
    - Always prioritize the caller's needs and attempt to resolve their inquiry before ending the call.  

Pronunciation Directive:
- Always pronounce names of people and departments directly without spelling them. Ensure proper pronunciation to maintain a natural conversational tone.

To send test email, ask who is asking and what is the reason. after getting the answer, call sendEmailAWS to destination lev.kantorovich@gmail.com with subject "user call" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.

If necessary, provide an option to email a billing specialist or transfer during business hours (following the validation steps below).  
Once the location is confirmed, follow location-based procedures. If a transfer or email is required, apply the validation and time-based rules as above.  

If the user has property management or HOA inquiries use the redirectCall function with +14155553921.  
If the user has urgent maintenance issues call redirectCall function with +12065557845.
If the user has non-urgent maintenance issues clarify the issue then call redirectCall function with +16465552347.
If the user has billing inquiries call redirectCall function with +13055556712.
If the user has leasing  inquiries call redirectCall function with +14083339356.

`
                    }
                ],
                "provider"      : "openai",
                "maxTokens"     : 300,
                "temperature"   : 0.7
            },
            recordingEnabled        : true,
            firstMessage            : "Hello, this is Intempus Realty voice answering system. How may I assist you today?",
            voicemailMessage        : "Hey, this is Vasa. Could you please call me back when you're free?",
            endCallFunctionEnabled  : true,
            endCallMessage          : "Thank you for contacting us. Have a great day!",
            transcriber             : {
                "model"     : "nova-2",
                "keywords"  : [
                    // TODO:
                    // Generate this programmatically instead of hardcoding
                    "Michael:30",
                    "Mike:30",
                    "Khesin:30",
                    "Camarena:30",
                    "Eugene:30",
                    "Korsunsky:30",
                    "Marybeth:30",
                    "Forcier:30",
                    "Galina:30",
                    "Kuterhina:30",
                    "Eric:30",
                    "Burris:30",
                    "Kimberly:30",
                    "Emperador:30",
                    "Dan:30",
                    "Kozakevich:30",
                    "Doug:30",
                    "Raisch:30",
                    "Brenda:30",
                    "Fisher:30",
                    "leasing:30",
                    "billing:30",
                    "maintenance:30",
                    "finance:30",
                    "accounting:30",
                    "office:30",
                    "HOA:30"
                ],
                "language"      : "en",
                "provider"      : "deepgram",
                "smartFormat"   : true
            },
            clientMessages  : [
                "conversation-update",
                "function-call"
            ],
            serverMessages  : [
                "hang",
                "model-output"
            ],
            endCallPhrases  : [
                "goodbye"
            ],
            backchannelingEnabled: false,
            backgroundDenoisingEnabled: false,
            startSpeakingPlan: {
                "smartEndpointingEnabled": true
            },
            isServerUrlSecretSet: false
    } as Vapi.CreateAssistantDto);
}
