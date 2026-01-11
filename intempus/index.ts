import {
    Vapi
}                       from '@vapi-ai/server-sdk';
import * as Contacts    from '../Contacts';

import * as assistants  from './assistants';
import * as tools       from './tools';
import * as squads      from './squads';

export const assistantsByName = {
    "IntempusBot"           : assistants.getBotOldVersion,
    "Intempus HOA"          : assistants.getHOA,
    "Intempus PropertyOwner": assistants.getPropertyOwner,
    "Intempus DialByName"   : assistants.getDialByName,
    // "Intempus FAQ"          : assistants.getFAQ,
    "Intempus CallbackForm" : assistants.getCallbackForm,
    "Intempus Introduction" : assistants.getIntroduction,
    "Intempus Main"         : assistants.getIntempusMain,
} as Record<string,(
    contacts            : Contacts.Contact[], 
    toolsByName         : Record<string,Vapi.ListToolsResponseItem>,
    existingAssistant   : (Vapi.Assistant | undefined)
) => Vapi.CreateAssistantDto>;

export const toolsByName = {
    'redirectCall'          : tools.getRedirectCall,
    'dispatchCall'          : tools.getDispatchCall,
    'sendEmail'             : tools.getSendEmail,
    'guessState'            : tools.getGuessState,
    'getUserFromPhone'      : tools.getUserFromPhone,
    'getFAQAnswer'          : tools.getFAQAnswer,
} as Record<string,(
    contacts    : Contacts.Contact[]
) => Vapi.CreateToolsRequest>;

export const squadsByName = {
    'Intempus IVR Squad'    : squads.getIVR,
} as Record<string,(
    assistantsByName    : Record<string,Vapi.Assistant>,
) => Vapi.CreateSquadDto>;
