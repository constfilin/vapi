import {
    Vapi
}                       from '@vapi-ai/server-sdk';

import * as Config      from '../Config';
import * as Contacts    from '../Contacts';

export const getDispatchCall = ( contacts:Contacts.Contact[] ) : Vapi.CreateToolsRequest => {
    const config = Config.get();
    const result =  {
        'type'     : 'function',
        'async'    : false,
        'function' : {
            name        : 'dispatchCall',
            description : "API gets a person name, looks up spreadsheet contacts, checks current time and return instructions how to dispatch the call",
            parameters  : {
                'type' : 'object',
                properties : {
                    name : {
                        type        : 'string',
                        description : 'The name of the person to dispatch the call to',
                        'enum'      : contacts.map(c=>c.name)
                    }
                },
                required : [
                    "name"
                ]
            }
        },
        messages : [
            {
                "type": "request-response-delayed",
                "content": "Dispatching call is taking a bit longer"
            },
            ...contacts.map( c => {
                return {
                    // https://docs.vapi.ai/api-reference/tools/create#request.body.function.messages.request-complete.role
                    "type"      : "request-start",
                    "content"   : `Dispatching your call to ${c.name}`,
                    conditions  : [{
                        param   : 'name',
                        operator: 'eq', 
                        value   : c.name
                    }]
                } as Vapi.ToolMessageStart;
            }),
            {
                "role"   : "system",
                "type"   : "request-complete",
                "content": "."
            },
            {
                "type": "request-failed",
                "content": "Cannot dispatch call"
            }
        ] as Vapi.CreateFunctionToolDtoMessagesItem[],
        server : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateFunctionToolDto;
    return result;
}

export const getRedirectCall = ( contacts:Contacts.Contact[] ) : Vapi.CreateToolsRequest => {
    const config = Config.get();
    const tool = {
        type            : "transferCall",
        destinations    : [] as Vapi.TransferDestinationNumber[],
        'function'      : {
            name        : "redirectCall",
            description : "Use this function to transfer the call to various contacts across different departments",
            parameters      : {
                type        : "object",
                properties  : {
                    destination : {
                        type        : 'string',
                        description : 'The destination phone number for the call transfer',
                        'enum'      : [] as string[],
                    },
                },
                required    : [
                    "destination"
                ]
            },
        },
        messages        : [] as Vapi.ToolMessageStart[],
        server : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateTransferCallToolDto;
    const destinationEnums  = tool['function']!.parameters!.properties!.destination!.enum!;
    contacts.forEach( c => {
        // TODO:
        // The same phone number can be listed in the contacts multiple times
        // In this case VAPI will produce the _first_ message in `messages` array
        // that match the phone number. If a specific message needs to be listed
        // then the contact for this message needs to be listed first in the Contacts
        // spreadsheet
        const fullPhone     = `+1${c.phoneNumbers[0]}`;
        if( !destinationEnums.includes(fullPhone) )
            destinationEnums.push(fullPhone);
        tool.destinations!.push({
            'type'      :   'number',
            number      :   fullPhone,
            //message     :   `I am forwarding your call to ${c.name}. Please stay on the line`,
            description :   c.description ? `${c.name} - ${c.description}` : c.name,
            //callerId    :   `+17254446330`,
            transferPlan : {
                mode        : 'warm-transfer-say-message',
                message     : 'Incoming call from Intempus',
                //sipVerb     : 'refer',
                summaryPlan : {
                    enabled : true,
                    messages : [
                        {
                            role    : "system",
                            content : "Please provide a summary of the call"
                        },
                        {
                            role    : "user",
                            content : "Here is the transcript: {{transcript}} "
                        }

                    ]
                }
            }
        } as Vapi.TransferDestinationNumber);
        // tool.messages!.push({
        //     'type'      : 'request-start',
        //     content     : `I am forwarding your call to ${c.name}. Please stay on the line`,
        //     conditions  : [{
        //         param   : 'name',
        //         operator: 'eq',
        //         value   : c.name as unknown as Record<string,unknown>
        //     }]
        // } as Vapi.CreateTransferCallToolDtoMessagesItem);
    });
    // Special group extensions
    if( !destinationEnums.includes("+15103404275") )
        destinationEnums.push("+15103404275");
    if( !(tool.destinations as Vapi.TransferDestinationNumber[]).some(d=>(d.number==='+15103404275')) )
        tool.destinations!.push({
            type        : 'number',
            number      : '+15103404275',
            message     : 'I am forwarding your call to Maintenance HOA',
            description : 'Maintenance HOA',
        });
    if( !destinationEnums.includes("+19162358444") )
        destinationEnums.push("+19162358444");
    if( !(tool.destinations as Vapi.TransferDestinationNumber[]).some(d=>(d.number==='+19162358444')) )
        tool.destinations!.push({
            type        : 'number',
            number      : '+19162358444',
            message     : 'I am forwarding your call to Emergency Group',
            description : 'Emergency Group',
        });
    if( !destinationEnums.includes("+14083593034") )
        destinationEnums.push("+14083593034");
    if( !(tool.destinations as Vapi.TransferDestinationNumber[]).some(d=>(d.number==='+14083593034')) )
        tool.destinations!.push({
            type        : 'number',
            number      : '+14083593034',
            message     : 'I am forwarding your call to Leasing Group',
            description : 'Leasing Group',
        });

    // In case if the call is forwarded to unknown contact
    /*
    tool.messages!.push({
        'type'      : 'request-start',
        content     : `I am forwarding your call...`,
    });
    */
    return tool as Vapi.CreateTransferCallToolDto;
}

export const getSendEmail = ( contacts:Contacts.Contact[] ) : Vapi.CreateToolsRequest => {
    const config    = Config.get();
    const toArgName = 'to';
    const tool = {
        'type'      : "function",
        "async"     : false,
        'function'  : {
            "name"          : "sendEmail",
            "description"   : "Sending Email",
            "parameters"    : {
                "type"      :"object",
                properties  : {
                    [toArgName]    : {
                        "type"      :"string",
                        description : 'The email address',
                        'enum'      : [] as string[],
                    },
                    "text"  : {
                        "type"      : "string"
                    },
                    "subject": {
                        "type"      : "string"
                    },
                },
                required: [
                    toArgName,
                    "text",
                    "subject"
                ]
            }
        },
        messages    :[
            {
                "type"      : "request-response-delayed",
                "content"   : "Sending email is taking a bit longer to respond"
            },
            {
                "role"      : "system",
                "type"      : "request-complete",
                "content"   : "Hangup"
            },
            {
                "type"      : "request-failed",
                "content"   : "Cannot send email"
            }
        ],
        server  : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateFunctionToolDto;
    const toEnums  = tool['function']!.parameters!.properties![toArgName]!.enum;
    contacts.forEach( c => {
        // TODO:
        // The same phone number can be listed in the contacts multiple times
        // In this case VAPI will produce the _first_ message in `messages` array
        // that match the phone number. If a specific message needs to be listed
        // then the contact for this message needs to be listed first in the Contacts
        // spreadsheet
        if( !c.emailAddresses[0] )
            return;
        if( toEnums && !toEnums.includes(c.emailAddresses[0]) )
            toEnums.push(c.emailAddresses[0]);
        /*
        tool.messages!.push({
            'type'      : 'request-start',
            content     : `I am sending email to ${c.name}. Please stay on the line`,
            conditions  : [{
                param   : 'name',
                operator: 'eq',
                value   : c.name as unknown as Record<string,unknown>
            }]
        } as Vapi.CreateTransferCallToolDtoMessagesItem);
        */
    });

    return tool;
}

export const getGuessState = ( /*contacts:Contacts.Contact[]*/ ) : Vapi.CreateToolsRequest => {
    const config    = Config.get();
    const tool = {
        'type'      : "function",
        "async"     : false,
        'function'  : {
            "name"          : "guessState",
            "description"   : "Guess State of the Caller",
            "parameters"    : {
                "type"      :"object",
                properties  : {
                },
                required: [
                ]
            }
        },
        messages    :[
            {
                "type"      : "request-response-delayed",
                "content"   : "Guessing state is taking a bit longer to respond"
            },
            {
                "role"      : "system",
                "type"      : "request-complete",
                "content"   : "Hangup"
            },
            {
                "type"      : "request-failed",
                "content"   : "Cannot guess state"
            }
        ],
        server  : {
            "url"            : `${config.publicUrl}/tool`,
            "timeoutSeconds" : 30,
            "secret"         : config.vapiToolSecret,
            // I've seen a situation VAPI _dost not_ submit the secret key in "X-Vapi-Secret" header
            // even though it is configured to do so. I am not surprised given all kinds of other 
            // mess there (see https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412)
            // So, as a workaround, let's just have our own secret header
            "headers"        : {
                "X-Secret"   : config.vapiToolSecret
            }            
        }
    } as Vapi.CreateFunctionToolDto;
    return tool;
}

