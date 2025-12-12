import {
    Vapi
}                       from '@vapi-ai/server-sdk';
import * as Contacts    from '../Contacts';

import * as assistants from './assistants';
import * as tools      from './tools';

export const assistantsByName = {
    "IntempusBot"               : assistants.getBotOldVersion,
    "Intempus IVR Introduction" : assistants.getIVRIntroduction,
    "Intempus IVR HOA"          : assistants.getIVRHOA,
    "Intempus IVR PropertyOwner": assistants.getIVRPropertyOwner,
    "Intempus IVR DialByName"   : assistants.getIVRDialByName,
    "Intempus IVR FAQ"          : assistants.getIVRFAQ,
    "Intempus IVR CallbackForm" : assistants.getIVRCallbackForm,
    "Intempus IVR Main"         : assistants.getIVRMain,
    "Introduction (next version)": assistants.getIVRIntroductionNextVersion,
} as Record<string,(
    contacts            : Contacts.Contact[], 
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant | undefined)
) => Vapi.CreateAssistantDto>;

export const toolsByName = {
    'redirectCall'  : tools.getRedirectCall,
    'dispatchCall'  : tools.getDispatchCall,
    'sendEmail'     : tools.getSendEmail,
    'guessState'    : tools.getGuessState,
} as Record<string,(
    contacts    : Contacts.Contact[]
) => Vapi.CreateToolsRequest>;
