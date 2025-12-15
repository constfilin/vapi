import {
    Vapi
}                       from '@vapi-ai/server-sdk';
import * as Contacts    from '../Contacts';

import * as assistants from './assistants';
import * as tools      from './tools';

export const assistantsByName = {
    "IntempusBot"               : assistants.getBotOldVersion,
    "Intempus HOA"          : assistants.getIVRHOA,
    "Intempus PropertyOwner": assistants.getIVRPropertyOwner,
    "Intempus DialByName"   : assistants.getIVRDialByName,
    "Intempus FAQ"          : assistants.getIVRFAQ,
    "Intempus CallbackForm" : assistants.getIVRCallbackForm,
    "Intempus Main"         : assistants.getIVRMain,
    "Intempus Introduction": assistants.getIVRIntroduction,
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
