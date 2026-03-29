import { ElevenLabs } from '@elevenlabs/elevenlabs-js';

import * as Config          from '../Config';
import * as Contacts        from '../Contacts';

import * as elevenLabsConsts  from './consts';
import { getTransferToNumber, getTransferToAgent } from './tools';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const _joinSteps = ( steps:string[] ) : string => {
    if( steps.length === 0 )
        throw Error("steps is empty");
    if( steps.length === 1 )
        return steps[0];
    return steps.map((s,ndx) => {
        return `${ndx+1}. ${s}`;
    }).join("\n");
};

const _getToolIds = ( toolsByName: Record<string,ElevenLabs.Tool>, toolNames:string[] ) : string[] => {
    return toolNames.map(name => {
        const tool = toolsByName[name];
        if( !tool )
            throw Error(`Tool ${name} not found`);
        return tool.id;
    });
};
const _getAgentIds = ( agentsByName: Record<string,any>, agentNames:string[] ) : {name:string, id:string}[] => {
    return agentNames.map(name => {
        const agent = agentsByName[name];
        if( !agent )
            throw Error(`Agent ${name} not found`);
        return { name, id: agent.agentId };
    });
};

const _getAsrKeywords = ( contacts:Contacts.Contact[] ) : string[] => {
    const keywords = Object.values(contacts
        .map(c => c.name.split(/\s+/))
        .flat()
        .reduce((acc,n) => {
            n = n.replace(/[^a-zA-Z]/g,'');
            const lower = n.toLowerCase();
            if( ["a","an","the","for","to","oncall","in","by","of","main","hoa"].includes(lower) )
                return acc;
            acc[lower] = n;
            return acc;
        },{} as Record<string,string>));
    return [
        ...keywords.map(n => `${n}:10`),
        "H-O-A:10",
        "Maintenance:10",
        "Property:10",
        "Realty:10",
        "Intempus:10",
    ];
};

type CreateAgentRequest = ElevenLabs.conversationalAi.BodyCreateAgentV1ConvaiAgentsCreatePost;

/**
 * Build a complete ElevenLabs agent config from partial overrides.
 * This is the ElevenLabs counterpart of intempus/assistants.ts `_completeAssistant`.
 */
const _completeAgent = (
    partial : {
        name            : string;
        firstMessage?   : string;
        language?       : string;
        secondLanguageFirstMessage? : string;
    },
    contacts        : Contacts.Contact[],
    toolIds         : string[],
    content         : string,
    agentsByName?   : Record<string,any>,
    transferNames?  : string[],
) : CreateAgentRequest => {
    const config = Config.get();
    return {
        name                : partial.name,
        conversationConfig  : {
            agent: {
                firstMessage: partial.firstMessage,
                language    : partial.language ?? "en",
                prompt: {
                    prompt      : content,
                    llm         : config.elevenLabs.model as ElevenLabs.Llm,
                    temperature : 0.3,
                    maxTokens   : 300,
                    toolIds,
                    builtInTools: {
                        transferToNumber: getTransferToNumber(contacts),
                        transferToAgent: (agentsByName && transferNames?.length)
                            ? getTransferToAgent(_getAgentIds(agentsByName,transferNames))
                            : undefined,
                    },
                    ignoreDefaultPersonality: true,
                },
            },
            tts: {
                voiceId: config.elevenLabs!.voiceId,
            },
            asr: {
                keywords: _getAsrKeywords(contacts),
            },
            languagePresets: {
                es: {
                    overrides: {
                        agent: {
                            firstMessage: partial.secondLanguageFirstMessage,
                            // Optional: add Spanish-specific prompt or voice
                        }
                    }
                }
            }
        },
    };
};

// ---------------------------------------------------------------------------
// Assistants (agents)
// ---------------------------------------------------------------------------

export const getMain = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    return _completeAgent(
        {
            name         : "Intempus Main",
            firstMessage : "Hello, I am Emily, an AI assistant for Intempus Realty. Are you an Intempus Realty customer?",
            secondLanguageFirstMessage : "Hola, soy Emily, una asistente de IA para Intempus Realty. ¿Eres un cliente de Intempus Realty?",
        },
        contacts,
        _getToolIds(toolsByName,['dispatchCall','dispatchUserByPhone','getFAQAnswer']),
        // Please note that the system prompt for "Intempus Main" get dynamically overwritten in pre-call handler. See api/index.ts for details. 
        // The dynamic part is the section that handles the case when we can identify the user by their phone number and get their first name. 
        // In that case we want to personalize the first message with their name and provide them with a more friendly greeting.
`<TASKS>
${_joinSteps([
    `Pretend that the user said "Hello" and call the "dispatchUserByPhone" tool, wait for result`,
    `If "dispatchUserByPhone" tool returns a user proceed with next instruction, otherwise redirect the caller to the "Intempus Introduction" agent`,
    `If tool returned a user: 
        When user asks a question call "getFAQAnswer" tool with the question asked by the user in order to get the answer from the FAQ database.
            - Provide the answer to the user.
            - Repeat this process until user hangs up or says that it wants to end the call.`
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}
${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
        ['Intempus Introduction'],
    );
};

export const getUnkIntroduction = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    return _completeAgent(
        {
            name         : "Intempus Introduction",
            firstMessage : "You've reached the Intempus Realty Main Menu. Are you a homeowner board member or a resident calling about H-O-A and Community Management Services?",
            secondLanguageFirstMessage : "Has llegado al menú principal de Intempus Realty. ¿Eres un miembro de la junta de propietarios o un residente que llama sobre los servicios de H-O-A y administración comunitaria?",
        },
        contacts,
        _getToolIds(toolsByName,['sendEmail']),
        `<TASKS>
${_joinSteps([
    `Briefly introduce yourself using the information in the IDENTITY section.`,
    `Follow the instruction in the MENU_SEQUENCE section but if at any point during the call (even if you are in the middle 
    of asking a question) the caller mentions a keyword defined in the KEYWORDS_AND_ACTIONS section then stop the script 
    immediately and execute the action of the keyword. 

    <MENU_SEQUENCE>
    If the caller has not expressed a specific intent, guide them by asking the following questions one-by-one. After each question, pause and listen.
    1. "Are you a homeowner board member or a resident calling about H-O-A and Community Management Services?"
        - Tell "I am forwarding your call to our H-O-A and Community Management Services."
    2. "Are you a property owner or tenant calling about our rental management services, scheduling a showing, or selling your home?"
        - Tell "I am forwarding your call to our Property Management Services."
    3. "Would you like to get a name directory and know the name of the person you would like to talk to?"
        - Tell "I am forwarding your call to our Dial By Name assistant"
    4. "Would you like to leave your information for a callback from Intempus?"
        - Tell "I am forwarding your call to our Callback Form assistant"
    5. "Would you like to hear these options again?"
        - Go to the first task again
    </MENU_SEQUENCE>

    <KEYWORDS_AND_ACTIONS>:
    Monitor the caller's speech for the following intents:
    | Indent Keywords to Listen For | Action to Take |
    | :--- | :--- |
    | Leasing, Rentals | Tell "Forwarding to leasing" |
    | Maintenance, Repair | Tell "Forwarding to maintenance" |
    | Emergency | Tell "Forwarding to emergency line" |
    | Finance, Accounting, Payments, Accounts Payable, Account Receivable, Operator, Representative | Tell "Forwarding to finance" |
    | Sales | Tell "Forwarding to sales" |
    | Menu | Follow the instructions in MENU_SEQUENCE section |
    </KEYWORDS_AND_ACTIONS>`,
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}
${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
        ['Intempus HOA', 'Intempus PropertyOwner', 'Intempus DialByName', 'Intempus CallbackForm'],
    );
};

export const getUnkHOA = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    const config = Config.get();
    return _completeAgent(
        {
            name         : "Intempus HOA",
            firstMessage : "You have reached Intempus H-O-A department. Would you like to request H-O-A maintenance, H-O-A payments, parking calls, or something else?",
            secondLanguageFirstMessage : "Has llegado al departamento de H-O-A de Intempus. ¿Desea solicitar mantenimiento de H-O-A, pagos de H-O-A, llamadas de estacionamiento o algo más?",
        },
        contacts,
        _getToolIds(toolsByName,['sendEmail']),
        `<TASKS>
${_joinSteps([
    `Identify the category of the call by asking the next series of yes/no questions one-by-one. 
    Pause after each question to give the user a chance to answer. 
    Execute the instructions after each question as soon as you get an affirmative answer.
    If the user proactively identifies one of the categories below, then execute the corresponding instructions immediately.
    The questions and instructions are as follows:
    a. "Are you calling about regular maintenance, parking calls or application status?"
        - Follow the instructions in the EMAILING_STEPS section.
        - Tell "I am forwarding your call to our regular maintenance services."
    b. "Are you calling about payments, estoppel requests, or community association management services sales?"
        - Follow the instructions in the EMAILING_STEPS section.
        - Tell "I am forwarding your call to our community association management payments."
    c. "Do you need an emergency maintenance assistance?"
        - Tell "I am forwarding your call to emergency maintenance."
    d. "Would you like to hear these options again?"
        - Go to the first task again`,
    `Ensure the caller is kept informed about the next steps or actions being taken on their behalf.`
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}

<EMAILING_STEPS>
${_joinSteps([
    "Ask for the caller's name",
    "Ask for the name of the property",
    "Confirm both details back to the caller",
    `ONLY AFTER confirming the caller's name and the property name, send an email using the 'sendEmail' tool with:
    - To: "${config.notificationEmailAddress||'mkhesin@intempus.net'}"
    - Subject: "New Call to HOA: [Property Name] - From [Caller Name]"
    - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"`
])}
</EMAILING_STEPS>

${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
    );
};

export const getUnkPropertyOwner = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    const config = Config.get();
    return _completeAgent(
        {
            name         : "Intempus PropertyOwner",
            firstMessage : "This is Intempus Realty Property Owner menu.",
            secondLanguageFirstMessage : "Has llegado al departamento de H-O-A de Intempus. ¿Desea solicitar mantenimiento de H-O-A, pagos de H-O-A, llamadas de estacionamiento o algo más?",
        },
        contacts,
        _getToolIds(toolsByName,['sendEmail']),
        `<TASKS>
${_joinSteps([
    `Identify the category of the call by asking the next series of yes/no questions one-by-one.
    Pause after each question to give the user a chance to answer.
    Execute the instructions after each question as soon as you get an affirmative answer.
    If the user proactively identifies one of the categories below, then execute the corresponding instructions immediately.
    The questions and instructions are as follows:
    a. "Are you calling about rental property maintenance?"
        - Follow the instructions in the EMAILING_STEPS section.
        - Tell "I am forwarding your call to our regular maintenance services."
    b. "Are you calling about scheduling a showing, leasing, submitting a rental application, or making a rent payment?"
        - Follow the instructions in the EMAILING_STEPS section.
        - Tell "I am forwarding your call to our community association management payments."
    c. "Are you calling about selling a property?"
        - Follow the instructions in the EMAILING_STEPS section.
    d. "Are you calling about rental property emergency maintenance?"
        - Tell "I am forwarding your call to emergency maintenance."
    e. "Would you like to hear these options again?"
        - Go to the first task again`,
    `Ensure the caller is kept informed about the next steps or actions being taken on their behalf.`,
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}

<EMAILING_STEPS>
${_joinSteps([
    "Ask for the caller's name",
    "Ask for the name of the property",
    "Confirm both details back to the caller",
    `ONLY AFTER confirming the caller's name and the property name, send an email using the 'sendEmail' tool with:
    - To: "${config.notificationEmailAddress||'mkhesin@intempus.net'}"
    - Subject: "New Call to PropertyOwner: [Property Name] - From [Caller Name]"
    - Body: "A caller named [Caller Name] is inquiring about property [Property Name] and is asking about [Caller's Request]"`
])}
</EMAILING_STEPS>

${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
    );
};

export const getFAQ = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    return _completeAgent(
        {
            name         : "Intempus FAQ",
            firstMessage : "Hello, this is Intempus Realty FAQ menu",
            secondLanguageFirstMessage : "Hola, este es el menú de preguntas frecuentes de Intempus Realty",
        },
        contacts,
        [],
        `<TASKS>
${_joinSteps([
    `Ask caller: "Do you want to return to previous menu?"`,
    `If the caller responds affirmatively, end the call.`
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}
${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
    );
};

export const getUnkCallbackForm = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    const config = Config.get();
    return _completeAgent(
        {
            name         : "Intempus CallbackForm",
            firstMessage : "",
            secondLanguageFirstMessage : "",
        },
        contacts,
        _getToolIds(toolsByName,['sendEmail']),
        `
<TASKS>
${_joinSteps([
    `Ask caller: "Please let us know if you are an existing or prospective client" and save the answer as 'clientType'`,
    `Ask caller: "Are you looking to rent your property, looking to buy a property or deciding to between renting and selling?" and save the answer as 'propertyInterest'.`,
    `If the caller is looking to rent their property, ask: "What is the address of your property" and save the answer as 'propertyAddress'. Otherwise ask: "What state, county or zip code you would like your to live in?" and save the answer as 'locationInterest'.`,
    `Ask caller: "What is your first and last name?" and save the answer as 'name'.`,
    `Ask caller: "Would you like to leave us your email address" and if the caller responds affirmatively, then ask "Please provide your email address", re-confirm it and after the re-confirmation save the answer as 'emailAddress'.`,
    `If the caller confirms the information, then tell them: "Thank you for providing this information. A representative will reach out to you shortly." and send an email:
        - To: "${config.notificationEmailAddress||'mkhesin@intempus.net'}"
        - Subject: "New Call for CallbackForm: [Property Name] - From [Caller Name]"
        - Body: "A client {{clientType}} is interested in {{propertyInterest}}. Property address is {{propertyAddress}}. Location of interest is {{locationInterest}}. Client name is {{name}}, email address is {{emailAddress}}, phone number is {{customer.number}}.`,
])}
</TASKS>

${elevenLabsConsts.systemPromptHeader}
${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
    );
};

export const getUnkDialByName = (
    contacts    : Contacts.Contact[],
    toolsByName : Record<string,ElevenLabs.Tool>,
    agentsByName? : Record<string,any>,
) : CreateAgentRequest => {
    const callRoutingInstructions = [
        ...contacts.map((c) => {
            return `If the user asks for "${c.name}", call dispatchCall with "${c.name}", wait for result and immediately follow the instructions of the result.`;
        }),
        `If user asks for anyone else then ask the user to repeat the name and then call dispatchCall with the name of the person. Wait for result and immediately follow the instructions of the result.`
    ];
    return _completeAgent(
        {
            name         : "Intempus DialByName",
            firstMessage : "Hello, this is Intempus Realty dial by name directory. Who would you like to reach?.",
            secondLanguageFirstMessage : "Hola, este es el directorio de marcación por nombre de Intempus Realty. ¿A quién le gustaría comunicarse?",
        },
        contacts,
        _getToolIds(toolsByName,['sendEmail','dispatchCall']),
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

${elevenLabsConsts.systemPromptHeader}
<CALLROUTING>
${_joinSteps(callRoutingInstructions)}
</CALLROUTING>
${elevenLabsConsts.systemPromptFooter}`,
        agentsByName,
    );
};