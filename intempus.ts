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
                        value   : c.name
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
    // Special group extensions
    destinationEnums.push("Maintenance HOA");
    tool.destinations!.push({
        type        : 'number',
        number      : '+14083205509',
        extension   : '18',
        message     : 'I am forwarding your call to Maintenance HOA',
        description : 'Maintenance HOA',
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

export const getGuessStateTool = () : Vapi.CreateFunctionToolDto => {
    const config    = Config.get();
    const tool = {
        'type'      : "function",
        "async"     : false,
        'function'  : {
            "name"          : "guessState",
            "description"   : "Guess State of the Caller",
            "parameters"    : {
                "type"      :"object",
                properties  : {
                },
                required: [
                ]
            }
        },
        messages    :[
            {
                "type"      : "request-response-delayed",
                "content"   : "Guessing state is taking a bit longer to respond"
            },
            {
                "role"      : "system",
                "type"      : "request-complete",
                "content"   : "Hangup"
            },
            {
                "type"      : "request-failed",
                "content"   : "Cannot guess state"
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
    return tool;
}

export const getAssistant = (
    contacts            : Contacts.Contact[],
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ListToolsResponseItem[]
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
- If the caller provides a name of a city or county, you will guess the state based on the provided location and re-confirm the state with the caller.
- If the caller request involves a location outside of these states, then tell "we have a business partner that is providing service in this state, please leave your name, the best time and phone number to reach you and someone will get back to you.". Collect the caller's response to a text and send an email to mkhesin@intemput.net with subject "New Inquiry for {{callerLocation}}" and body "Caller Name: {{callerName}}, Phone: {{callerPhone}}, Message: {{callerMessage}}". Then end the call.
- If the caller asks for H-O-A then call guessState. If the result is unknown then clarify which state they are referring to. If the state is California, then act as if the caller asks for California H-O-A. If the state is Florida then act as if the caller asks for Florida H-O-A. Otherwise act as if the caller asks for "General H-O-A".
- If the caller asks for Property Management then guessState. If the result is unknown then clarify which state they are referring to. If the state is California or Indiana, then act as if the caller asks for "Property Management for California, Indiana". Otherwise act as if the caller asks for "Property Management for Tennessee, Georgia, South Carolina, Ohio, Florida".
- If the caller asks for Leasing then call guessState. If the result is unknown then clarify which state they are referring to. If the state is Indiana, then act as if the caller asks for "Leasing for Indiana". For any other state, including California, act as if the caller asks for "Leasing Inquiries".
- If the caller asks for Maintenance then call guessState. If the result is unknown then clarify which state they are referring to. If the state is Indiana then act as if the caller asks for "Maintenance for Indiana". For any other state, including California, clarify if the caller has an urgent maintenance issue. If so then act as if the caller asks for "urgent maintenance issues". Otherwise act as if the caller asks for "non-urgent maintenance issues".

General Guidelines:
- Always listen to the caller needs.
- Be polite, professional, and efficient at all times.
- If the caller's speech is unclear or delayed then politely repeat your previous phrase or ask for clarifications.
- If a transfer or email cannot be completed after attempts to clarify, say "Redirecting the call to operator" then call dispatchCall with "Intempus Main Office", wait for result and immediately follow the instructions of the result.
- Always prioritize the caller's needs and attempt to resolve their inquiry before ending the call.
- If the caller's question has to do with a termination or an extension of caller's active lease, then ask who is the caller's property manager and then dispatch the call as if the caller asks for that person. If the caller does not know his or her property manager, then act as if the caller asks for "General H-O-A".

Error Handling:
- If the customer's words or intend is unclear, ask clarifying questions. If you encounter any issues, inform the customer politely and ask to repeat.

Pronunciation Directive:
- Always pronounce names of people and departments (other than H-O-A) directly without spelling them.`;

    // let's look at existing tools
    // TODO:
    // In the new version of VAPI API not all tools have to have a name
    // so the name code will probably break
    const toolsByName = existingTools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ListToolsResponseItem>);
    const missingToolName = ['redirectCall','sendEmail','dispatchCall'].find(n=>!(n in toolsByName));
    if( missingToolName )
        throw Error(`Cannot find tool '${missingToolName}'`);
    const redirectCallTool  = toolsByName['redirectCall'];
    if( !redirectCallTool )
        throw Error(`Tool 'redirectCall' is not found`);
    const sendEmailTool     = toolsByName['sendEmail'];
    if( !sendEmailTool )
        throw Error(`Tool 'sendEmail' is not found`);
    const dispatchCallTool  = toolsByName['dispatchCall'];
    if( !dispatchCallTool )
        throw Error(`Tool 'dispatchCall' is not found`);
    const guessStateTool    = toolsByName['guessState'];
    if( !guessStateTool )
        throw Error(`Tool 'guessState' is not found`);
    const useAssemblyAI     = false;
    const keywords          = Object.values(contacts
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
        },{} as Record<string,string>));
    const keyterm           = [
        "H-O-A",
        "Maintenance",
        "Property",
        "Realty",
        "Intempus",
        "voice",
        "Bot",
        //...contacts.map(c=>c.name)
    ];
    const assistant         = {
        name : "IntempusBot",
        voice       : {
            "voiceId"               : "luna",
            "provider"              : "deepgram",
            "fillerInjectionEnabled": false,
            "inputPunctuationBoundaries": [
                "."
            ]
        },
        voicemailDetection: {
            provider    : 'vapi',
            backoffPlan : {
                maxRetries      : 6,
                startAtSeconds  : 5,
                frequencySeconds: 5
            },
            beepMaxAwaitSeconds: 0
        },
        // Note:
        // This seems to be ineffective
        voicemailMessage : "Call is going to voicemail",
        model       : {
            "model": "gpt-4o-mini",
            "toolIds": [
                redirectCallTool.id,
                sendEmailTool.id,
                dispatchCallTool.id,
                guessStateTool.id
            ],
            "messages": [
                {
                    "role"   : "system",
                    "content": `${systemPromptHeader}without spelling them.

To send test email, ask who is asking and what is the reason. after getting the answer, call sendEmail to destination constfilin@gmail.com with subject "Caller Name: {{callerName}}, Phone: {{callerPhone}}" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.

If necessary, provide an option to email a billing specialist or transfer during business hours (following the validation steps below).
Once the location is confirmed, follow location-based procedures. If a transfer or email is required, apply the validation and time-based rules as above.

`
                }
            ],
            "provider"      : "openai",
            "maxTokens"     : 300,
            "temperature"   : 0.3,
            //"tools"         : [
            //    // TODO:
            //    // This set of tools allows registrations of tool callbacks _immediately_ with registration
            //    // of the assistant. The type of the entries in `tools` array is `Vapi.OpenAiModelToolsItem`
            //    // We just need to fill this array out
            //    {
            //        async : false,
            //        type  : "voicemail"
            //    } as Vapi.OpenAiModelToolsItem
            //]
        },
        recordingEnabled        : true,
        firstMessage            : "Hello, this is Intempus Realty voice answering system. How may I assist you today?",
        endCallFunctionEnabled  : true,
        endCallMessage          : "Thank you for contacting us. Have a great day!",
        transcriber             : (useAssemblyAI ? {
            provider            :"assembly-ai",
            language            : "en",
            confidenceThreshold : 0.4,
            disablePartialTranscripts:false,
            wordBoost           : keywords.slice(0,2500),
        } : {
            provider            : "deepgram",
            language            : "en",
//            model               : "nova-2-phonecall",
            model               : "nova-3",
            confidenceThreshold : 0.4,
            keywords            : keywords.map(n=>`${n}:10`),
            keyterm             : keyterm,
            smartFormat         : true
        }),
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
            // phone call control has to be commented out
            // See https://discord.com/channels/1211482211119796234/1211483291191083018/threads/1379590374393118860
            //'phone-call-control',
            //'speech-update',
            //'status-update',
            //'transcript',
            //'transcript[transcriptType="final"]',
            'tool-calls',
            //'transfer-destination-request',
            'user-interrupted',
            //'voice-input'
        ],
        endCallPhrases  : [
            "goodbye"
        ],
        backchannelingEnabled: false,
        backgroundSound: "off",
        backgroundDenoisingEnabled: true,
        startSpeakingPlan: {
            "smartEndpointingPlan": {
                "provider" : "livekit",
            },
            // @deprecated
            "smartEndpointingEnabled": "livekit",
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
        },
    } as Vapi.CreateAssistantDto;

    assistant.model!.messages![0].content += contacts
        .map( c => {
            return `If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        })
        .join("\n")+"\n"+
        "If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result.";
    console.log(assistant);
    return assistant;
}
export const getIVRIntroductionAssistant = async (
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ListToolsResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    const config = Config.get();

    // Map existing tools by their function.name -> tool item
    const toolsByName = existingTools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ListToolsResponseItem>);

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus IVR Introduction";
    const assistant = {
        // Basic metadata
        name,

        // Voice settings (from JSON)
        voice: {
            model: "aura-2",
            voiceId: "luna",
            provider: "deepgram",
            inputPunctuationBoundaries: ["。"]
        },

        // model block
        model: {
            model: "gpt-4o",
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `[Identity]  
You are Emily, an AI Interactive Voice Response system for **Intempus Realty**, a property management company 
providing services across California, Indiana, Florida, Nevada, South Carolina, Georgia, Ohio, and Tennessee.

[Style]  
- Use a polite and professional tone.  
- Communicate clearly and concisely.  
- Ensure a warm and welcoming demeanor throughout the interaction. 

[Response Guidelines]  
- Ask one question at a time and wait for user response before proceeding.  
- Maintain clarity by confirming the user's inputs when needed.  
- Inform the caller about the handoff destination before transferring the call. 

[Task & Goals]  
1. Greet the caller promptly and gather their inquiry information.
2. Unless the caller has already answered those quesions, proceed to ask:
   a. "Are you a homeowner board member or a resident calling about HOA and Community Management Services?"
   b. If they respond affirmatively (e.g., "yes", "sure", "definitely", "of course"), then:
      - Inform them: "You will be redirected to our HOA and Community Management Services."
      - Call \`handoff_to_assistant\` with "Intempus IVR HOA".
   c. If they did not respond affirmatively, then:
      - Ask them: "Are you a property owner or tenant calling about our rental management services, scheduling a showing, or selling your home?"
   d. If they respond affirmatively:
      - Inform them: "You will be redirected to our Property Owner Services."
      - Call \`handoff_to_assistant\` with "Intempus IVR PropertyOwner".
3. Ensure the caller is kept informed about the next steps or actions being taken on their behalf.

[Error Handling / Fallback]  
- If the caller's input is unclear or if they provide an unexpected response, politely ask for clarification.
- In case of any doubts or errors in the process, offer assistance to help guide them to the appropriate department or information source.
`
                }
            ],
            provider: "openai"
        },

        firstMessage: "Hello, I am Emily, an AI assistant for Intempus Realty, Please let me know if you are a homeowner, a property board member or a resident calling about HOA and Community Management Services.",
        voicemailMessage: "Please call back when you're available.",
        endCallFunctionEnabled: true,
        endCallMessage: "Goodbye.",
        transcriber: {
            model: "nova-3",
            keyterm: [
                "H-O-A",
                "Maintenance",
                "Property",
                "Realty",
                "Intempus",
                "voice",
                "Bot",
                "IVR"
            ],
            language: "en",
            provider: "deepgram"
        },

        // Ensure server settings follow current config (timeout + secret + header)
        server: {
            url: `${config.publicUrl}/assistant/${encodeURIComponent(name)}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },

        // keep compatibility fields if needed by CreateAssistantDto
        compliancePlan: { pciEnabled: false } as any
    } as Vapi.CreateAssistantDto;

    return assistant;
}
export const getIVRHOAAssistant = async (
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ListToolsResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    const config = Config.get();

    // Map existing tools by their function.name -> tool item
    const toolsByName = existingTools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ListToolsResponseItem>);

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus IVR HOA";

    const assistant = {
        // Basic metadata (from IntempusIVRIntroductionAssistant.json -> Intempus IVR HOA)
        name,

        // Voice settings
        voice: {
            model: "aura-2",
            voiceId: "luna",
            provider: "deepgram",
            inputPunctuationBoundaries: ["。"]
        },

        // model block (uses mapped tool ids when available)
        model: {
            model: "gpt-4.1-mini",
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `[Identity]  
You are Emily, an AI Interactive Voice Response system for **Intempus Realty**, a property management company providing services across California, Indiana, Florida, Nevada, South Carolina, Georgia, Ohio, and Tennessee.

[Style]  
- Use a clear and professional tone.  
- Be patient and courteous.  
- Speak naturally, using pauses when needed to make the interaction feel human-like.

[Response Guidelines]  
- Ask one question at a time.
- Wait for the caller's response before proceeding to the next question.  
- Address the caller respectfully and keep interactions concise.  
- Do not repeat questions if the caller has already answered them.

[Task & Goals]  
1. Greet the caller warmly and introduce yourself as Intempus Realty's IVR system.  
2. Ask: "Would you like to request HOA maintenance?"
   - If the caller responds affirmatively (e.g., "yes", "sure", "definitely", "of course"), then transfer the call to "Maintenance HOA".
3. Ask: "Would you like to speak about HOA payments, parking calls, estoppable requests, or application status?"  
   - If the caller responds affirmatively, call redirectCall to the relevant department.  
4. Ask: "Would you like to speak with our Sales Department about Community Association management services?"  
   - If the caller responds affirmatively, then transfer the call to "Sales HOA".
5. Ask: "Would you like to get HOA emergency maintenance?"  
   - If the caller responds affirmatively, then transfer the call to "Emergency Group".
6. Ask: "Would you like to get back to the previous menu?"  
    - If the caller responds affirmatively, call \`handoff_to_assistant\` to "Intempus IVR Introduction".

[Error Handling / Fallback]  
- If the caller’s response is unclear, politely ask them to repeat their answer.  
- If an unexpected error occurs, apologize and attempt to redirect them to the main menu or an operator for further assistance.`
                }
            ],
            provider: "openai"
        },

        // messages and prompts
        firstMessage: "This is Intempus Realty HOA menu. Would you like to request HOA maintenance?",
        voicemailMessage: "Please call back when you're available.",
        endCallFunctionEnabled: true,
        endCallMessage: "Goodbye.",

        // transcriber settings
        transcriber: {
            model: "nova-3",
            keyterm: [
                "H-O-A",
                "Maintenance",
                "Property",
                "Realty",
                "Intempus",
                "voice",
                "Bot",
                "IVR"
            ],
            language: "en",
            provider: "deepgram"
        },

        // Ensure server settings follow current config (timeout + secret + header)
        server: {
            url: `${config.publicUrl}/assistant/${encodeURIComponent(name)}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },

        // keep compatibility fields if needed by CreateAssistantDto
        compliancePlan: { pciEnabled: false } as any
    } as Vapi.CreateAssistantDto;

    return assistant;
}
export const getIVRPropertyOwnerAssistant = async (
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ListToolsResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    const config = Config.get();

    // Map existing tools by their function.name -> tool item
    const toolsByName = existingTools.reduce( (acc,t) => {
        acc[t['function']!.name] = t;
        return acc;
    },{} as Record<string,Vapi.ListToolsResponseItem>);

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus IVR PropertyOwner";
    const assistant = {
        // Basic metadata (property owner focused)
        name,

        // Voice settings (reuse JSON voice)
        voice: {
            model: "aura-2",
            voiceId: "luna",
            provider: "deepgram",
            inputPunctuationBoundaries: ["。"]
        },

        model: {
            model: "gpt-4.1-mini",
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `[Identity]
You are Emily, an AI Interactive Voice Response system for **Intempus Realty**.

[Style]
- Use a clear and professional tone.
- Be patient and courteous.
- Speak naturally and keep interactions concise.

[Response Guidelines]
- Ask one question at a time and wait for the caller's response before proceeding.
- Confirm important inputs when necessary.

[Task & Goals]
1. Greet the caller and determine whether they are calling about rental management, scheduling a showing, selling a property, payments, or maintenance.
2. If the caller asks about maintenance, call \`redirectCall\` to the maintenance department (use mapped tool ids when available).
3. If the caller asks about scheduling a showing or leasing, collect the property address and preferred times, then call \`redirectCall\` to the appropriate leasing/contact.
4. If the caller asks about selling, collect basic details and hand off to Sales or call \`redirectCall\` as appropriate.
5. Keep the caller informed about actions being taken and offer to send follow-up emails when needed (call \`sendEmail\`).

[Error Handling / Fallback]
- If the caller's response is unclear, ask for clarification.
- If an unexpected error occurs, apologize and offer to transfer to an operator.`
                }
            ],
            provider: "openai"
        },

        firstMessage: "Hello, this is Intempus Realty. Are you calling about rental management, scheduling a showing, selling a property, or something else?",
        voicemailMessage: "Please call back when you're available.",
        endCallFunctionEnabled: true,
        endCallMessage: "Goodbye.",

        transcriber: {
            model: "nova-3",
            keyterm: [
                "rental",
                "showing",
                "lease",
                "maintenance",
                "seller",
                "payment",
                "H-O-A",
                "Intempus"
            ],
            language: "en",
            provider: "deepgram"
        },

        server: {
            url: `${config.publicUrl}/assistant/${encodeURIComponent(name)}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },

        // compatibility
        compliancePlan: { pciEnabled: false } as any
    } as Vapi.CreateAssistantDto;

    return assistant;
}
export const getToolByName = async (
    name    : string
) : Promise<Vapi.CreateToolsRequest> => {
    switch( name ) {
    case 'redirectCall':
        return getRedirectCallTool(await Contacts.get());
    case 'dispatchCall':
        return getDispatchCallTool(await Contacts.get());
    case 'sendEmail':
        return getSendEmailTool(await Contacts.get());
    case 'guessState':
        return getGuessStateTool();
    }
    throw Error(`Tool '${name}' s not known`);
}

export const getAssistantByName = async (
    name                : string,
    existingAssistant   : (Vapi.Assistant|undefined),
    existingTools       : Vapi.ListToolsResponseItem[]
) : Promise<Vapi.CreateAssistantDto> => {
    const config = Config.get();
    // if( name===config.assistantName )
    //     return getAssistant(await Contacts.get(),existingAssistant,existingTools);
    switch (name) {
        case "Intempus IVR Introduction":
            return getIVRIntroductionAssistant(existingAssistant, existingTools);
        case "Intempus IVR HOA":
            return getIVRHOAAssistant(existingAssistant, existingTools);
        case "Intempus IVR PropertyOwner":
            return getIVRPropertyOwnerAssistant(existingAssistant, existingTools);
        case "IntempusBot":
            return getAssistant(await Contacts.get(), existingAssistant, existingTools);
        default:
            throw Error(`Assistant '${name}' s not known`);
    }
}
