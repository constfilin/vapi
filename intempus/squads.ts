import {
    Vapi
}                           from '@vapi-ai/server-sdk';

import * as Config          from '../Config';

import * as intempus        from '.';

export const getIVR = (
    existingAssistantsByName    : Record<string,Vapi.Assistant>,
) : Vapi.CreateSquadDto => {

    const config            = Config.get();
    const existingIntroductionAssistant = existingAssistantsByName['Intempus Introduction'];
    if( !existingIntroductionAssistant )
        throw Error(`Expected existing assistant Intempus Introduction to be present`);
    const handoffAssistantNames  = Object.keys(intempus.assistantsByName).filter( (name) => {
        return (name !== 'Intempus Introduction' && name !== 'IntempusBot');
    });

    const result = {
        name: 'IVR for unknown users',
        //description: 'Squad for Intempus IVR system',
        members: [
            // First goes the Introduction assistant
            {
                assistantId : existingIntroductionAssistant.id,
                assistantOverrides : {
                    'tools:append' : [
                        {
                            type        : 'handoff',
                            //'async'     : false,
                            'function'  : {
                                'name'  : 'handoff_to_assistant',
                            },
                            messages   : [],
                            destinations : handoffAssistantNames
                                .map( (name) => {
                                    const existingAssistant = existingAssistantsByName[name];
                                    if( !existingAssistant )
                                        throw Error(`Expected existing assistant ${name} to be present`);
                                    return {
                                        type            : 'assistant',
                                        assistantId     : existingAssistant.id,
                                        //assistantsName  : existingAssistant.name
                                    };
                                })
                        }
                    ]
                }
            },
            // Then go all other assistants except, of course, the introduction and IntempusBot
            ...handoffAssistantNames
                .map( (name) => {
                    const existingAssistant = existingAssistantsByName[name];
                    if( !existingAssistant )
                        throw Error(`Expected existing assistant ${name} to be present`);
                    return {
                        assistantId : existingAssistant.id,
                        assistantOverrides : {
                            'tools:append' : [
                                {
                                    type        : 'handoff',
                                    //'async'     : false,
                                    'function'  : {
                                        'name'  : 'handoff_to_assistant',
                                    },
                                    messages   : [],
                                    destinations : [
                                        {
                                            type        : 'assistant',
                                            assistantId : existingIntroductionAssistant.id,
                                            //assistantsName : existingIntroductionAssistant.name
                                        }
                                    ]
                                }
                            ]
                        }
                    };
                })
        ]
    } as Vapi.CreateSquadDto;
    return result;
}