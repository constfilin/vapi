import {
    Vapi,
    VapiClient
}                       from '@vapi-ai/server-sdk';

import * as misc        from './misc';
import * as intempus    from './intempus';

export const getDispatchCallPayload = () : Vapi.CreateFunctionToolDto => {
    return {
        'type'     : 'function',
        'async'     : false,
        'function' : {
            name        : 'dispatchCall',
            description : "API gets a person name, looks up spreadsheet contacts, checks current time and return instructions how to dispatch the call",
            parameters  : {
                'type' : 'object',
                properties : {
                    name : {
                        'type' : 'string'
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
            {
                "role": "system",
                "type": "request-complete",
                "content": "."
            },
            {
                "type": "request-failed",
                "content": "Cannot dispatch call"
            }
        ],
        server : {
            "url"            : "https://demo.tectransit.com/api/vapi/dispatch",
            "timeoutSeconds" : 30,
            "secret"         : process.env.X_VAPI_SECRET||'ZZnxVey4U2UL'
        }
    }
}

export const findByName = ( vapiClient:VapiClient, name?:string ) : Promise<Vapi.ToolsListResponseItem|undefined> => {
    if( !name )
        throw Error(`name should be provided`);
    return vapiClient.tools.list().then( tools => {
        return tools.find(t=>(t['function']?.name===name));
    })
}

export const update = ( payload:Vapi.CreateFunctionToolDto ) : Promise<Vapi.ToolsUpdateResponse> => {
    const vapiClient   = misc.getVapiClient();
    return findByName(vapiClient,payload['function']?.name).then( t => {
        if( !t )
            throw Error(`Cannot find tool with name '${payload['function']!.name}'`);
        // @ts-expect-error
        delete payload.type;
        return vapiClient.tools.update(t.id,payload)
    });
} 

export const list = () => {
    return misc.getVapiClient().tools.list().then( tools => {
        return tools.map( t => {
            return {
                id : t.id,
                'function.name' : t['function']?.name
            }
        });
    });
}

export const createRedirectCall = async () => {
    return misc.getVapiClient().tools.create(intempus.getRedirectCallTool(await misc.getContacts(process.env.CONTACTS_SHEET_NAME)));
}

export const createDispatchCall = () => {
    return misc.getVapiClient().tools.create(getDispatchCallPayload());
}

export const updateRedirectCall = async () => {
    return update(intempus.getRedirectCallTool(await misc.getContacts(process.env.CONTACTS_SHEET_NAME)));
}

export const updateDispatchCall = () => {
    return update(getDispatchCallPayload());
}

export const getById = ( id?:string ) : Promise<Vapi.ToolsGetResponse|undefined> => {
    if( !id )
        throw Error(`Id is required`);
    return misc.getVapiClient().tools.get(id);
}

export const getByName = ( name?:string ) : Promise<Vapi.ToolsListResponseItem|undefined> => {
    if( !name )
        throw Error(`name should be provided`);
    return findByName(misc.getVapiClient(),name);
}

