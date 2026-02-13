import {
    Vapi
}                           from '@vapi-ai/server-sdk';

export const getCreateHandoffToolDtoDestinationsItem = ( assistantInfo:{name?:string,id?:string,description?:string} ) : Vapi.CreateHandoffToolDtoDestinationsItem => {
    const result = {
        type        : 'assistant',
        contextEngineeringPlan : {
            'type' : 'all'
        } as Vapi.HandoffDestinationAssistantContextEngineeringPlan,
        variableExtractionPlan : {
            schema : {
                type: 'object',
                properties: {
                    language: {
                        type: 'string',
                        enum: ['English','Spanish'],
                        description: 'The language of the conversation (English or Spanish)',
                        required: true
                    }
                },
                required: ['language']
            }
        } as Vapi.VariableExtractionPlan
        //assistantsName : existingIntroductionAssistant.name
    } as Vapi.HandoffDestinationAssistant;
    if( assistantInfo.id )
        result.assistantId = assistantInfo.id;
    else if( assistantInfo.name )
        result.assistantName = assistantInfo.name;
    if( assistantInfo.description )
        result.description = assistantInfo.description
    return result;
};

export const getHandoffToolItem = ( assistantInfos:{name?:string,id?:string,description?:string}[] ) : Vapi.CreateHandoffToolDto => {
    return {
        type        : 'handoff',
        //'async'     : false,
        'function'  : {
            'name'  : 'handoffToAssistant',
        },
        messages   : [],
        // The Introduction assistant can hand off to all other assistants (except Main and Bot)
        destinations : assistantInfos.map(getCreateHandoffToolDtoDestinationsItem)
    };
}

export default getHandoffToolItem;