import {
    Vapi
}                           from '@vapi-ai/server-sdk';

import * as Config          from '../Config';
import * as Contacts        from '../Contacts';

import * as intempusConsts  from './consts';

const _joinSteps = ( steps:string[] ) : string => {
    return steps.map((s,ndx) => {
        return `${ndx+1}. ${s}`;
    }).join("\n");
};

const _getTranscriber = ( contacts:Contacts.Contact[]) : Vapi.CreateAssistantDtoTranscriber => {
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
    return {
        provider            : "deepgram",
        language            : "multi",
        // model               : "nova-2-phonecall",
        model               : "nova-3",
        confidenceThreshold : 0.4,
        keywords            : keywords.map(n=>`${n}:10`),
        keyterm             : keyterm,
        smartFormat         : true
    };
}
const _getToolIds = ( toolsByName: Record<string,Vapi.ListToolsResponseItem>, toolNames:string[] ) : string[] => {
    return toolNames.map(name => {
        const tool = toolsByName[name];
        if( !tool )
            throw Error(`Tool ${name} not found`);
        return tool.id;
    });
}
const _completeAssistant = (
    assistant       : Partial<Vapi.CreateAssistantDto>,
    transcriber     : Vapi.CreateAssistantDtoTranscriber,
    toolIds         : string[],
    handoffToolsDto : (Vapi.CreateHandoffToolDto|undefined),
    content         : string,
) : Vapi.CreateAssistantDto => {
    if( !assistant.name )
        throw Error("Assistant name is required");
    if( assistant.firstMessageMode === "assistant-speaks-first" )
        if( !assistant.firstMessage )
            throw Error(`firstMessage is required when firstMessageMode is '${assistant.firstMessageMode}'`);
    const config = Config.get();
    const model = {
        model           : config.model,
        toolIds         : toolIds,
        messages  : [
            {
                "role"   : "system",
                "content": content
            }
        ],
        provider        : config.provider,
        maxTokens       : 300,
        temperature     : 0.3,
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
    } as Vapi.CreateAssistantDtoModel;
    //if( handoffToolsDto )
    //    model.tools = [handoffToolsDto];
    return {
        voicemailDetection: {
            provider    : 'vapi',
            backoffPlan : {
                maxRetries      : 6,
                startAtSeconds  : 5,
                frequencySeconds: 5
            },
            beepMaxAwaitSeconds: 0
        },
        voicemailMessage    : "Please call back when you're available.",
        endCallFunctionEnabled: true,
        endCallMessage      : "Goodbye.",
        recordingEnabled    : true,
        compliancePlan: {
            hipaaEnabled: false,
            pciEnabled: false
        },
        /*
        voice       : {
            provider              : "deepgram",
            voiceId               : "luna",
            cachingEnabled        : true,
            model                 : "aura-2",
            // @ts-expect-error
            "inputPunctuationBoundaries": [
                "."
            ]
        },
        */
        voice : {
            provider    : "azure",
            voiceId     : "en-US-AvaMultilingualNeural", // Primary voice
            fallbackPlan: {
                voices: [
                    {
                        provider: "azure",
                        voiceId: "es-ES-Elv1iraNeural",
                    }
                ]
            }
        },
        server      : {
            url             : `${config.publicUrl}/assistant/${assistant.name.replace(/[^a-zA-Z0-9-_]/g,"")}`,
            timeoutSeconds  : 30,
            // @ts-expect-error
            secret          : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            headers: {
                "X-Secret"  : config.vapiToolSecret
            }
        },
        model,
        transcriber,
        backgroundSound : "off",
        ...assistant
    }
}
export const getBotOldVersion = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined)
 ) : Vapi.CreateAssistantDto => {

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
    const systemPromptHeader = (false && firstSystemMessageContent?.split("</ERROR_HANDLING_AND_FALLBACK>")?.at(0)) || `
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
</STYLE>`;
    const tasksAndGoals = [
        "If the user wants to send test email, inquire who is asking and what is the reason. after getting the answer, call sendEmail to destination constfilin@gmail.com with subject \"Caller Name: {{callerName}}, Phone: {{callerPhone}}\" and body  in which provide who and why called. Then confirm sending the email and absolutely necessary call End Call Function.",
        ...contacts.map( c => {
            return `If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        }),
        "If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result."
    ];
    return _completeAssistant(
        {
            name            : "IntempusBot",
            firstMessage    : "Hello, this is Intempus Realty voice answering system. How may I assist you today?",
            firstMessageMode: "assistant-speaks-first",
            // Note:
            // This seems to be ineffective
            voicemailMessage: "Call is going to voicemail",
            clientMessages  : [
                // "conversation-update",
                // "function-call"
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
            startSpeakingPlan: {
                "smartEndpointingPlan": {
                    "provider" : "livekit",
                },
                // @deprecated
                "smartEndpointingEnabled": "livekit",
            }
        },        
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        undefined,
        `<TASKS>
${_joinSteps(tasksAndGoals)}
</TASKS>

${systemPromptHeader}
${intempusConsts.systemPromptFooter}`
    );
}
export const getUnkHOA = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();
    return _completeAssistant(
        { 
            name            : "Intempus HOA",
            firstMessage    : "You have reached Intempus HOA department. Would you like to request HOA maintenance, HOA payments, parking calls, or something else?",
            firstMessageMode: "assistant-speaks-first",
            voicemailMessage: "Please call back when you're available.",
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
            startSpeakingPlan: { waitSeconds: 1.5 },
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
        `<TASKS>
${_joinSteps([
    `Determine which category their call belongs to (HOA maintenance, HOA payments, parking calls, estoppel requests, application status, HOA community association management services sales, HOA emergency maintenance, or returning to the previous menu).
    * This step is ONLY for classification. Do NOT transfer the call at this point and do NOT call any tools at this step.*`,
    `Before transferring the call to ANY number, you must ALWAYS:
   - Ask for the caller's name
   - Ask for the name of the property
   - Confirm both details back to the caller`,
   `ONLY AFTER confirming the caller's name and the property name, send an email using the "sendEmail" tool with:
   - To: "${config.notificationEmailAddress}"
   - Subject: "New Call: [Property Name] - From [Caller Name]"
   - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"`,
    `Only AFTER:
   - The caller's name is collected
   - The property name is collected
   - The details are confirmed
   - The email has been sent
   THEN apply the correct routing as explained in the CALLROUTING section`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
<CALLROUTING>
- For HOA maintenance: transfer the call to +15103404275.
- For HOA payments, parking calls, estoppel requests, or application status: transfer to +15103404275.
- For HOA community association management services sales: transfer to +15103404275.
- For HOA emergency maintenance: transfer to +19162358444.
- If the caller wants to return to the previous menu: call "handoff_to_assistant" to "Intempus Introduction".
</CALLROUTING>
${intempusConsts.systemPromptFooter}`,
    );
}
export const getUnkPropertyOwner = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const config = Config.get();
    return _completeAssistant(
        {
            name            : "Intempus PropertyOwner",
            firstMessage    : "This is Intempus Realty Property Owner menu.",
            firstMessageMode: "assistant-speaks-first",
            startSpeakingPlan: { waitSeconds: 1.5 }
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
        `<TASKS>
${_joinSteps([
    `Determine which category their call belongs to (rental management, scheduling a showing, selling a property, payments, rental property maintenance, or rental property emergency maintenance).
    * This step is ONLY for classification. Do NOT transfer the call at this point and do NOT call any tools after this step.*`,
    `Before transferring the call to ANY number, you must ALWAYS:
    * Ask for the caller's name
    * Ask for the name of the property
    * Confirm both details back to the caller`,
    `ONLY AFTER confirming the caller's name and the property name, send an email using the "sendEmail" tool with:
    - To: "${config.notificationEmailAddress}"
    - Subject: "New Call: [Property Name] - From [Caller Name]"
    - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"
        Where [Caller's Request] is a short description such as:
        “scheduling a showing”
        “emergency maintenance”
        “rent payment”
        “rental application”
        “property management”
        “selling their property”
        etc.`,
    `Only AFTER all of the following:
    - The caller's name is collected
    - The property name is collected
    - The details are confirmed
    - The email has been sent
    THEN apply the correct routing as explained in the CALLROUTING section.`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
<CALLROUTING>
- For rental property maintenance: transfer the call to +15103404275.
- For scheduling a showing, leasing, submitting a rental application, or making a rent payment: transfer to +14083593034.
- For selling a property: transfer to +15103404275.
- For rental property emergency maintenance: transfer to +19162358444.
- If the caller wants to return to the previous menu: call "handoff_to_assistant" to "Intempus Introduction".
</CALLROUTING>
${intempusConsts.systemPromptFooter}`,
    );
}
//https://intempusrealty.com/frequently-asked-questions/
export const getFAQ = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    return _completeAssistant(
        {
            name            : "Intempus FAQ",
            firstMessage    : "Hello, this is Intempus Realty FAQ menu",
            firstMessageMode: "assistant-speaks-first",
        },        
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
        `<TASKS>
${_joinSteps([
    `Ask caller: "Do you want to return to previous menu?"`,
    `If the caller responds affirmatively call "handoff_to_assistant" to "Intempus Introduction".`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
${intempusConsts.systemPromptFooter}`
    );
}
//https://intempuspropertymanagement.com/santa-clara-property-management/
export const getUnkCallbackForm = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    return _completeAssistant(
        {
            // Basic metadata (property owner focused)
            name            : "Intempus CallbackForm",
            firstMessage    : null,
            firstMessageMode: "assistant-speaks-first-with-model-generated-message",
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
        `
<TASKS>
${_joinSteps([
    `Ask caller: "Please let us know if you are an existing or prospective client" and save the answer as 'clientType'`,
    `Ask caller: "Are you looking to rent your property, looking to buy a property or deciding to between renting and selling?" and save the answer as 'propertyInterest'.`,
    `If the caller is looking to rent their property, ask: "What is the address of your property" and save the answer as 'propertyAddress'. Otherwise ask: "What state, county or zip code you would like your to live in?" and save the answer as 'locationInterest'.`,
    `Ask caller: "What is your first and last name?" and save the answer as 'name'.`,
    `Ask caller: "Would you like to leave us your email address" and if the caller responds affirmatively, then ask "Please provide your email address", re-confirm it and after the re-confirmation save the answer as 'emailAddress'.`,
    `After collecting all the above information, tell the customer something like "You are an {{clientType}} client interested in {{propertyInterest}}. Your property address is {{propertyAddress}}. Your location of interest is {{locationInterest}}. Your name is {{name}}. Your email address is {{emailAddress}}. Your phone number is {{customer.number}}. Thank you for providing this information. A representative will reach out to you shortly.".`,
    `If instead of the answer on any of the above questions the caller says something like "I want to return to the previous menu", then call "handoff_to_assistant" to "Intempus Introduction".`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
${intempusConsts.systemPromptFooter}`
    );
}
export const getUnkDialByName = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    const callRoutingInstructions = [
        ...contacts.map((c) => {
            return `If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        }),
        `If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result.`
    ];
    return _completeAssistant(
        {
            name            : "Intempus DialByName",
            firstMessage    : "Hello, this is Intempus Realty dial by name directory. Who would you like to reach?.",
            firstMessageMode: "assistant-speaks-first"
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
        `<TASKS>
${_joinSteps([
    `Your main task is to assist callers in reaching the appropriate contact within Intempus Realty by name.`,
    `Greet the caller by saying "You reach the Intempus Realty Dial By Name directory".`,
    `Ask the caller for the name of the person they wish to reach and make sure that this name is mentioned in CALLROUTING section.,
       * If it is not mentioned, politely inform the caller that the name was not found and ask them to repeat or provide additional details.`,
    `Once you have the contact name, ask for the property name/address that the call is regarding.`,
    `Then ask for the caller's name.`,
    `After collecting all three pieces of information (contact name, property name, and caller name), confirm the details back to the caller.`,
    `After the confirmation, follow the instructions for the contact name in the CALLROUTING section.`,
    `Keep the caller informed about actions being taken and ensure they feel assisted throughout the process.`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
<CALLROUTING>
${_joinSteps(callRoutingInstructions)}
</CALLROUTING>
${intempusConsts.systemPromptFooter}`
    );
}
export const getUnkIntroduction = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    return _completeAssistant(
        {
            name            : "Intempus Introduction",
            firstMessage    : "You've reached the Intempus Realty Main Menu. Are you a homeowner board member or a resident calling about H-O-A and Community Management Services?",
            firstMessageMode: "assistant-speaks-first"
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','sendEmail','dispatchCall','guessState']),
        intempusConsts.getHandoffToolItem([
            {name:"Intempus HOA"},
            {name:"Intempus PropertyOwner"},
            {name:"Intempus DialByName"},
            {name:"Intempus CallbackForm"}
        ]),
        `<TASKS>
${_joinSteps([
    `Ask the caller the next series of yes/no questions one-by-one. Pause after each question to give the user a chance to answer. Execute the instruction after each question as soon as you get an affirmative answer.
    a. "Are you a homeowner board member or a resident calling about H-O-A and Community Management Services?"
        - Tell "I am forwarding your call to our HOA and Community Management Services."
        - Call "handoff_to_assistant" with "Intempus HOA".
    b. "Are you a property owner or tenant calling about our rental management services, scheduling a showing, or selling your home?"
        - Tell "I am forwarding your call to our Property Management Services."
        - Call "handoff_to_assistant" with "Intempus PropertyOwner".
    c. "Do you know the name of the person you would like to talk to?"
        - Tell "I am forwarding your call to our Dial By Name assistant"
        - Call "handoff_to_assistant" with "Intempus DialByName".
    d. "Would you like to leave your information for a callback from Intempus?"
        - Tell "I am forwarding your call to our Callback Form assistant"
        - Call "handoff_to_assistant" with "Intempus CallbackForm"
    e. "Would you like to hear these options again?"
        - Go to the first task again`,
    `Ensure the caller is kept informed about the next steps or actions being taken on their behalf.`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
${intempusConsts.systemPromptFooter}`,
    );
}
export const getMain = (
    contacts            : Contacts.Contact[],
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant|undefined),
) : Vapi.CreateAssistantDto => {
    return _completeAssistant(
        {
            name            : "Intempus Main",
            //firstMessage    : "Hello, I am Emily, an AI assistant for Intempus Realty. I can assist you in English and Spanish.",
            firstMessageMode: "assistant-speaks-first-with-model-generated-message",
        },
        _getTranscriber(contacts),
        _getToolIds(toolsByName,['redirectCall','dispatchUserByPhone','getFAQAnswer']),
        intempusConsts.getHandoffToolItem([
            {name:'Intempus Introduction'}
        ]),
`<TASKS>
${_joinSteps([
    `Call the "dispatchUserByPhone" tool,, wait for result and immediately follow the instructions in the result.`,
    `If "dispatchUserByPhone" tool returns a user then you must greet the user by name and then ask them what they would like assistance with today.`,
    `When user asks a question call "getFAQAnswer" tool with the question asked by the user in order to get the answer from the FAQ database.
      - Provide the answer to the user.
      - Repeat this process until user hangs up or says that it wants to end the call.`
])}
</TASKS>

${intempusConsts.systemPromptHeader}
${intempusConsts.systemPromptFooter}`
    );
}
