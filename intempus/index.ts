import {
    Vapi
}                       from '@vapi-ai/server-sdk';
import * as Contacts    from '../Contacts';

import * as assistants  from './assistants';
import * as tools       from './tools';
import * as squads      from './squads';

export const assistantsByName = {
    "Intempus Main"         : assistants.getMain,
    "Intempus HOA"          : assistants.getUnkHOA,
    "Intempus PropertyOwner": assistants.getUnkPropertyOwner,
    "Intempus DialByName"   : assistants.getUnkDialByName,
    "Intempus CallbackForm" : assistants.getUnkCallbackForm,
    "Intempus Introduction" : assistants.getUnkIntroduction,
    "IntempusBot"           : assistants.getBotOldVersion,
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
    'dispatchUserFromPhone' : tools.dispatchUserFromPhone,
    'getFAQAnswer'          : tools.getFAQAnswer,
} as Record<string,(
    contacts    : Contacts.Contact[]
) => Vapi.CreateToolsRequest>;

export const squadsByName = {
    'Intempus IVR Squad'    : squads.getIVR,
} as Record<string,(
    assistantsByName    : Record<string,Vapi.Assistant>,
) => Vapi.CreateSquadDto>;
