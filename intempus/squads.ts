import {
    Vapi
}                           from '@vapi-ai/server-sdk';

import * as Config          from '../Config';

import * as intempus        from '.';

export const getIVR = (
    existingAssistantsByName    : Record<string,Vapi.Assistant>,
) : Vapi.CreateSquadDto => {

    const config            = Config.get();
    const existingMainAssistant         = existingAssistantsByName['Intempus Main'];
    const existingIntroductionAssistant = existingAssistantsByName['Intempus Introduction'];
    if( !existingIntroductionAssistant )
        throw Error(`Expected existing assistant Intempus Introduction to be present`);
    const excludedAssistantNames = [
        existingMainAssistant.name,             // main assistant is not part of IVR squad
        existingIntroductionAssistant.name,     // has to go first and mentioned explicitly
        'IntempusBot',                          // deprecated bot assistant
    ];
    const handoffAssistantNames  = Object.keys(intempus.assistantsByName).filter(name=>!excludedAssistantNames.includes(name))

    const result = {
        name: 'Intempus IVR',
        //description: 'Squad for Intempus IVR system',
        members: [
            // First goes the Main assistant
            {
                assistantId : existingMainAssistant.id,
                assistantOverrides : {
                    'tools:append' : [
                        {
                            type        : 'handoff',
                            //'async'     : false,
                            'function'  : {
                                'name'  : 'handoff_to_assistant',
                            },
                            messages   : [],
                            // The main assistant sometimes hands off to the Introduction assistant
                            destinations : [
                                {
                                    type        : 'assistant',
                                    assistantId : existingIntroductionAssistant.id,
                                    variableExtractionPlan : {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                language: {
                                                    type: 'string',
                                                    enum: ['English','Spanish'],
                                                    description: 'Caller language preference extracted from the conversation for the purpose of passing it as a variable during call handoff to the next assistant',
                                                    required: true
                                                }
                                            },
                                            required: ['language']
                                        }
                                    }
                                    //assistantsName : existingIntroductionAssistant.name
                                }
                            ]
                        }
                    ]
                }
            },
            // Second goes the Unknown Introduction assistant
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
                            // The Introduction assistant can hand off to all other assistants (except Main and Bot)
                            destinations : handoffAssistantNames
                                .map( (name) => {
                                    const existingAssistant = existingAssistantsByName[name];
                                    if( !existingAssistant )
                                        throw Error(`Expected existing assistant ${name} to be present`);
                                    return {
                                        type            : 'assistant',
                                        assistantId     : existingAssistant.id,
                                        variableExtractionPlan : {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    language: {
                                                        type: 'string',
                                                        enum: ['English','Spanish'],
                                                        description: 'Caller language preference extracted from the conversation for the purpose of passing it as a variable during call handoff to the next assistant',
                                                        required: true
                                                    }
                                                },
                                                required: ['language']
                                            }
                                        }
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
                                    // All other assistants hand off to the Introduction assistant
                                    destinations : [
                                        {
                                            type        : 'assistant',
                                            assistantId : existingIntroductionAssistant.id,
                                            variableExtractionPlan : {
                                                schema: {
                                                    type: 'object',
                                                        properties: {
                                                            language: {
                                                                type: 'string',
                                                                enum: ['English','Spanish'],
                                                                description: 'Caller language preference extracted from the conversation for the purpose of passing it as a variable during call handoff to the next assistant',
                                                                required: true
                                                            }
                                                        },
                                                    required: ['language']
                                                }
                                                }
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