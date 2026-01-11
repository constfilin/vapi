import {
    Vapi
}                       from '@vapi-ai/server-sdk';
import * as Contacts    from '../Contacts';

import * as assistants  from './assistants';
import * as tools       from './tools';
import * as squads      from './squads';

export const assistantsByName = {
    "Intempus Main"             : assistants.getMain,
    "Intempus Unk HOA"          : assistants.getUnkHOA,
    "Intempus Unk PropertyOwner": assistants.getUnkPropertyOwner,
    "Intempus Unk DialByName"   : assistants.getUnkDialByName,
    "Intempus Unk CallbackForm" : assistants.getUnkCallbackForm,
    "Intempus Unk Introduction" : assistants.getUnkIntroduction,
    "IntempusBot"               : assistants.getBotOldVersion,
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
