import {
    Vapi
}                           from '@vapi-ai/server-sdk';

import * as Config          from '../Config';
import * as Contacts        from '../Contacts';

import * as intempusConsts  from './consts';


export const getBotOldVersion = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined)
 ) : Vapi.CreateAssistantDto => {

    const config = Config.get();

    // let's look at existing assistant
    const firstSystemMessageContent = existingAssistant?.model?.messages?.find( m => {
        return m.role==='system'
    })?.content;
    // The prompt consists of 2 parts
    // 1. "standard" prompt
    // 2. The part generated based on contacts
    //
    // We want to preserve the second part if possible and override the first part as necessary
    // The first part ends with </ERROR_HANDLING_AND_FALLBACK>
    const theFirstPart = (false && firstSystemMessageContent?.split("</ERROR_HANDLING_AND_FALLBACK>")?.at(0)) || `
<IDENTITY>
You are an AI voice bot representing **Intempus Realty**. Your role is to assist callers promptly, efficiently, and courteously with their
inquiries. You will handle a variety of requests, including rental property questions, property management services, H-O-A services, maintenance
requests, billing issues, lockouts, call transfers, and emailing.
</IDENTITY>

<SECURITY_AND_SAFETY_OVERRIDES>
${intempusConsts.securityAndSafetyOverrides}
</SECURITY_AND_SAFETY_OVERRIDES>

<GEOGRAPHIC_SERVICE_AREA_RESTRICTION>
- Intempus Realty only provides services in California, Indiana, Florida, Nevada, South Carolina, Georgia, Ohio, and Tennessee.
- If the caller provides a name of a city or county, you will guess the state based on the provided location and re-confirm the state with the caller.
- If the caller request involves a location outside of these states, then tell "we have a business partner that is providing service in this state, please leave your name, the best time and phone number to reach you and someone will get back to you.". Collect the caller's response to a text and send an email to mkhesin@intemput.net with subject "New Inquiry for {{callerLocation}}" and body "Caller Name: {{callerName}}, Phone: {{callerPhone}}, Message: {{callerMessage}}". Then end the call.
- If the caller asks for H-O-A then call guessState. If the result is unknown then clarify which state they are referring to. If the state is California, then act as if the caller asks for California H-O-A. If the state is Florida then act as if the caller asks for Florida H-O-A. Otherwise act as if the caller asks for "General H-O-A".
- If the caller asks for Property Management then guessState. If the result is unknown then clarify which state they are referring to. If the state is California or Indiana, then act as if the caller asks for "Property Management for California, Indiana". Otherwise act as if the caller asks for "Property Management for Tennessee, Georgia, South Carolina, Ohio, Florida".
- If the caller asks for Leasing then call guessState. If the result is unknown then clarify which state they are referring to. If the state is Indiana, then act as if the caller asks for "Leasing for Indiana". For any other state, including California, act as if the caller asks for "Leasing Inquiries".
- If the caller asks for Maintenance then call guessState. If the result is unknown then clarify which state they are referring to. If the state is Indiana then act as if the caller asks for "Maintenance for Indiana". For any other state, including California, clarify if the caller has an urgent maintenance issue. If so then act as if the caller asks for "urgent maintenance issues". Otherwise act as if the caller asks for "non-urgent maintenance issues".
</GEOGRAPHIC_SERVICE_AREA_RESTRICTION>

<STYLE>
- Always listen to the caller needs.
- Be polite, professional, and efficient at all times.
- If the caller's speech is unclear or delayed then politely repeat your previous phrase or ask for clarifications.
- If a transfer or email cannot be completed after attempts to clarify, say "Redirecting the call to operator" then call dispatchCall with "Intempus Main Office", wait for result and immediately follow the instructions of the result.
- Always prioritize the caller's needs and attempt to resolve their inquiry before ending the call.
- You will also request or clarify geographic information when relevant (e.g., Santa Clara County, Alameda, Contra Costa).
- If the caller's question has to do with a termination or an extension of caller's active lease, then ask who is the caller's property manager and then dispatch the call as if the caller asks for that person. If the caller does not know his or her property manager, then act as if the caller asks for "General H-O-A".
</STYLE>
${intempusConsts.systemPromptFooter}`;

    // let's look at existing tools
    // TODO:
    // In the new version of VAPI API not all tools have to have a name
    // so the name code will probably break
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
    const tasksAndGoals = [
        "If the user wants to send test email, inquire who is asking and what is the reason. after getting the answer, call sendEmail to destination constfilin@gmail.com with subject \"Caller Name: {{callerName}}, Phone: {{callerPhone}}\" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.",
        ...contacts.map( c => {
            return `If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        }),
        "If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result."
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
            model: config.model,
            "toolIds": [
                redirectCallTool.id,
                sendEmailTool.id,
                dispatchCallTool.id,
                guessStateTool.id
            ],
            "messages": [
                {
                    "role"   : "system",
                    "content": `${theFirstPart}
<TASKS_AND_GOALS>
${tasksAndGoals.map((tng,ndx) => {
    return `${ndx+1}. ${tng}`;
}).join("\n")}
</TASKS_AND_GOALS>
`
                }
            ],
            provider      : config.provider,
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
    return assistant;
}
export const getHOA = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus HOA";

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
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}
<TASKS_AND_GOALS>
1. Greet the caller and determine which category their call belongs to (HOA maintenance, HOA payments, parking calls, estoppel requests, application status, HOA community association management services sales, HOA emergency maintenance, or returning to the previous menu).
   *This step is ONLY for classification. Do NOT transfer the call at this point and do NOT call any tools at this step.*
2. Before transferring the call to ANY number, you must ALWAYS:
   - Ask for the caller's name
   - Ask for the name of the property
   - Confirm both details back to the caller
3. ONLY AFTER confirming the caller's name and the property name, send an email using the "sendEmail" tool with:
   - To: "vkurganecki@gmail.com"
   - Subject: "New Call: [Property Name] - From [Caller Name]"
   - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"
4. Only AFTER:
   - The caller's name is collected
   - The property name is collected
   - The details are confirmed
   - The email has been sent
   THEN apply the correct routing as explained in the CALLROUTING section
</TASKS_AND_GOALS>

<CALLROUTING>
- For HOA maintenance: transfer the call to +15103404275.
- For HOA payments, parking calls, estoppel requests, or application status: transfer to +15103404275.
- For HOA community association management services sales: transfer to +15103404275.
- For HOA emergency maintenance: transfer to +19162358444.
- If the caller wants to return to the previous menu: call "handoff_to_assistant" to "Intempus Introduction".
</CALLROUTING>
${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider,
            maxTokens: 5000
        },

        // messages and prompts
        firstMessage: "This is Intempus Realty HOA menu. Would you like to request HOA maintenance, HOA payments, parking calls, or something else?",
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

        serverMessages  : [
            //'conversation-update',
            //'end-of-call-report',
            'function-call',
            'hang',
            //'model-output',
            // phone call control has to be commented out
            // See https://discord.com/channels/1211482211119796234/1211483291191083018/threads/1379590374393118860
            //'phone-call-control',
            //'speech-update',
            'status-update',
            //'transcript',
            //'transcript[transcriptType="final"]',
            'tool-calls',
            'transfer-destination-request',
            //'user-interrupted',
            //'voice-input'
        ],

        // Ensure server settings follow current config (timeout + secret + header)
        server: {
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },

        // keep compatibility fields if needed by CreateAssistantDto
        compliancePlan: { pciEnabled: false } as any,
        startSpeakingPlan: { waitSeconds: 1.5 }
    } as Vapi.CreateAssistantDto;

    return assistant;
}
export const getPropertyOwner = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus PropertyOwner";
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
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}
<TASKS_AND_GOALS>
1. Greet the caller and determine which category their call belongs to (rental management, scheduling a showing, selling a property, payments, rental property maintenance, or rental property emergency maintenance).
   * This step is ONLY for classification. Do NOT transfer the call at this point and do NOT call any tools after this step.*
2. Before transferring the call to ANY number, you must ALWAYS:
   * Ask for the caller's name
   * Ask for the name of the property
   * Confirm both details back to the caller
3. ONLY AFTER confirming the caller's name and the property name, send an email using the "sendEmail" tool with:
   - To: "vkurganecki@gmail.com"
   - Subject: "New Call: [Property Name] - From [Caller Name]"
   - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"
     Where [Caller's Request] is a short description such as:
       “scheduling a showing”
       “emergency maintenance”
       “rent payment”
       “rental application”
       “property management”
       “selling their property”
       etc.
4. Only AFTER all of the following:
   - The caller's name is collected
   - The property name is collected
   - The details are confirmed
   - The email has been sent
   THEN apply the correct routing as explained in the CALLROUTING section.
</TASKS_AND_GOALS>

<CALLROUTING>
- For rental property maintenance: transfer the call to +15103404275.
- For scheduling a showing, leasing, submitting a rental application, or making a rent payment: transfer to +14083593034.
- For selling a property: transfer to +15103404275.
- For rental property emergency maintenance: transfer to +19162358444.
- If the caller wants to return to the previous menu: call "handoff_to_assistant" to "Intempus Introduction".
</CALLROUTING>
${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider,
            maxTokens: 5000
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
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },

        // compatibility
        compliancePlan: { pciEnabled: false } as any,
        startSpeakingPlan: { waitSeconds: 1.5 }
    } as Vapi.CreateAssistantDto;

    return assistant;
}
//https://intempusrealty.com/frequently-asked-questions/
export const getFAQ = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus FAQ";
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
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}
<TASKS_AND_GOALS>
Ask caller: "Do you want to return to previous menu?"
If the caller responds affirmatively call "handoff_to_assistant" to "Intempus Introduction".
</TASKS_AND_GOALS>
${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider
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
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
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
//https://intempuspropertymanagement.com/santa-clara-property-management/
export const getCallbackForm = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    // See https://docs.vapi.ai/assistants/dynamic-variables#default-variables
    // about default variables like {{customer.number}}
    const name = "Intempus CallbackForm";
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
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}
<TASKS_AND_GOALS>
1. Ask caller: "Please let us know if you are an existing or prospective client" and save the answer as 'clientType'.
2. Ask caller: "Are you looking to rent your property, looking to buy a property or deciding to between renting and selling?" and save the answer as 'propertyInterest'.
3. If the caller is looking to rent their property, ask: "What is the address of your property" and save the answer as 'propertyAddress'. Otherwise ask: "What state, county or zip code you would like your to live in?" and save the answer as 'locationInterest'.
4. Ask caller: "What is your first and last name?" and save the answer as 'name'.
5. Ask caller: "Would you like to leave us your email address" and if the caller responds affirmatively, then ask "Please provide your email address", re-confirm it and after the re-confirmation save the answer as 'emailAddress'.
6. After collecting all the above information, tell the customer something like "You are an {{clientType}} client interested in {{propertyInterest}}. Your property address is {{propertyAddress}}. Your location of interest is {{locationInterest}}. Your name is {{name}}. Your email address is {{emailAddress}}. Your phone number is {{customer.number}}. Thank you for providing this information. A representative will reach out to you shortly.".
7. If instead of the answer on any of the above questions the caller says something like "I want to return to the previous menu", then call "handoff_to_assistant" to "Intempus Introduction".
</TASKS_AND_GOALS>
${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider
        },

        firstMessage: null,
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
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
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
export const getDialByName = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');
    const callRoutingInstructions = [
        ...contacts.map( (c,ndx) => {
            return `${ndx+1}. If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        }),
        `${contacts.length+1}. If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result.`
    ];
    const name = "Intempus DialByName";
    const assistant = {
        // Basic metadata
        name,

        // Voice settings
        voice: {
            model: "aura-2",
            voiceId: "luna",
            provider: "deepgram",
            inputPunctuationBoundaries: ["。"]
        },

        model: {
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}

<TASKS_AND_GOALS>
1. Your main task is to assist callers in reaching the appropriate contact within Intempus Realty by name.
2. Greet the caller warmly and introduce yourself as Intempus Realty's IVR system.
3. Ask the caller for the name of the person they wish to reach and make sure that this name is mentioned in CALLROUTING section.
   * If it is not mentioned, politely inform the caller that the name was not found and ask them to repeat or provide additional details.
4. Once you have the contact name, ask for the property name/address that the call is regarding.
5. Then ask for the caller's name.
6. After collecting all three pieces of information (contact name, property name, and caller name), confirm the details back to the caller.
8. After the confirmation, follow the instructions for the contact name in the CALLROUTING section.
10. Keep the caller informed about actions being taken and ensure they feel assisted throughout the process.
</TASKS_AND_GOALS>

<CALLROUTING>
${callRoutingInstructions.join("\n")}
</CALLROUTING>

${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider
        },

        firstMessage: "Hello, this is Intempus Realty dial by name system. Who would you like to reach to?.",
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
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
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
export const getIntroduction = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();

    // Prefer mapping known tool names to actual ids (if present)
    const desiredNames = ['redirectCall','sendEmail','dispatchCall','guessState'];
    const mappedToolIds = desiredNames
        .map(n => toolsByName[n]?.id)
        .filter((id): id is string => typeof id === 'string');

    const name = "Intempus Introduction";
    const assistant = {
        name: "Intempus Introduction",
        voice: {
            model: "aura",
            voiceId: "luna",
            provider: "deepgram"
        },
        model: {
            model: config.model,
            toolIds: mappedToolIds.length ? mappedToolIds : undefined,
            messages: [
                {
                    role: "system",
                    content: `${intempusConsts.systemPromptHeader}
<TASKS_AND_GOALS>
1. Ask the caller the next series of yes/no questions one-by-one. Pause after each question to give the user a chance to answer. Execute the instruction after each question as soon as you get an affirmative answer.
   a. "Are you a homeowner board member or a resident calling about /eɪtʃ oʊ eɪ/ and Community Management Services?"
      - Tell "I am forwarding your call to our HOA and Community Management Services."
      - Call "handoff_to_assistant" with "Intempus HOA".
   b. "Are you a property owner or tenant calling about our rental management services, scheduling a showing, or selling your home?"
      - Tell "I am forwarding your call to our Property Management Services."
      - Call "handoff_to_assistant" with "Intempus PropertyOwner".
   c. "Do you know the name of the person you would like to talk to?"
      - Tell "I am forwarding your call to our Dial By Name assistant"
      - Call "handoff_to_assistant" with "Intempus DialByName".
   d. "Do you have a general question about Intempus Property Management"?
      - Tell "I am forwarding your call to our Frequently Asked Questions assistant"
      - Call "handoff_to_assistant" with "Intempus FAQ"
   e. "Would you like to leave your information for a callback from Intempus?"
      - Tell "I am forwarding your call to our Callback Form assistant"
      - Call "handoff_to_assistant" with "Intempus CallbackForm"
   f. "Would you like to hear these options again?"
      - Go to the first task again
2. Ensure the caller is kept informed about the next steps or actions being taken on their behalf.
</TASKS_AND_GOALS>
${intempusConsts.systemPromptFooter}`
                }
            ],
            provider: config.provider
        },
        firstMessage: "Hello, I am Emily, an AI assistant for Intempus Realty, .... Are you a homeowner board member or a resident calling about H-O-A and Community Management Services?",
        voicemailMessage: "Please call back when you're available.",
        endCallMessage: "Goodbye.",
        transcriber: {
            model: "flux-general-en",
            language: "en",
            provider: "deepgram"
        },
        compliancePlan: {
            hipaaEnabled: false,
            pciEnabled: false
        },
        server: {
            url: `${config.publicUrl}/assistant/${name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
            timeoutSeconds: 30,
            secret: config.vapiToolSecret,
            headers: {
                "X-Secret": config.vapiToolSecret
            }
        },
    } as Vapi.CreateAssistantDto;

    return assistant;
}
