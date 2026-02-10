import {
    Vapi
}                           from '@vapi-ai/server-sdk';

import getHandoffToolItem   from './getHandoffToolItem';
import * as intempus        from '.';

export const getIVR = (
    existingAssistantsByName    : Record<string,Vapi.Assistant>,
) : Vapi.CreateSquadDto => {

    const existingMainAssistant         = existingAssistantsByName['Intempus Main'];
    const existingIntroductionAssistant = existingAssistantsByName['Intempus Introduction'];
    if( !existingIntroductionAssistant )
        throw Error(`Expected existing assistant Intempus Introduction to be present`);
    const excludedAssistantNames = [
        existingMainAssistant.name,             // main assistant is not part of IVR squad
        existingIntroductionAssistant.name,     // has to go first and mentioned explicitly
        'IntempusBot',                          // deprecated bot assistant
    ];
    const handoffAssistantNames  = Object.keys(intempus.assistantsByName).filter(name=>!excludedAssistantNames.includes(name));
    const result = {
        name: 'Intempus IVR',
        //description: 'Squad for Intempus IVR system',
        members: [
            // First goes the Main assistant
            {
                assistantId : existingMainAssistant.id,
                assistantOverrides : {
                    'tools:append' : [
                        getHandoffToolItem([{id:existingIntroductionAssistant.id}])
                    ]
                }
            },
            // Second goes the Unknown Introduction assistant
            {
                assistantId : existingIntroductionAssistant.id,
                assistantOverrides : {
                    'tools:append' : [
                        getHandoffToolItem(handoffAssistantNames.map( (name) => {
                            const existingAssistant = existingAssistantsByName[name];
                            if( !existingAssistant )
                                throw Error(`Expected existing assistant ${name} to be present`);
                            return {id:existingAssistant.id};
                        }))
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
                                getHandoffToolItem([{id:existingIntroductionAssistant.id}])
                            ]
                        }
                    };
                })
        ]
    } as Vapi.CreateSquadDto;
    return result;
}
