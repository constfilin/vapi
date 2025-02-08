import jwt          from 'jsonwebtoken';
import {
    Vapi,
    VapiClient
}                   from '@vapi-ai/server-sdk';

import * as consts  from './consts';
import * as misc    from './misc';

export const get_token = () => {
    const payload = { orgId: (process.env.VAPI_ORG_ID||'52859bb9-27df-41ee-8c6d-c300c1c75bbd') };
    const key     = process.env.VAPI_PRIVATE_KEY||'';
    const options = { expiresIn: '1h' };
    // @ts-expect-error
    return jwt.sign(payload,key,options);
}

export const get_vapi_client = () => {
    return (new VapiClient({ token: get_token() }));
}

export const get_dispatch_call_payload = () : Vapi.ToolsCreateRequest => {
    return {
        'type'     : 'function',
        'async'     : false,
        'function' : {
            name        : 'dispatchCall',
            description : "API, которое получает имя человека (или департамента), потом делает lookup в Google Spreadsheet, проверяет текущее время в тайм зоне человека и возвращает что с этим звонком надо делать.",
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

export const get_transfer_call_payload = async () : Promise<{
    json    : Vapi.CreateFunctionToolDto,
    prompt  : string[],
    warns   : string[]
}> => {
    const sheet = await misc.getSheet(consts.apiKey,consts.spreadsheetId,'Contacts');
    const rows  = await sheet.getRows({});
    return rows.reduce((acc,r,ndx) => {
        const name = r.get("Name");
        if( typeof name != 'string' )
            throw Error(`Name is missing in row #${ndx}`);
        const phones = r.get("Phone");
        if( typeof phones != 'string' )
            throw Error(`Phones is missing in row #${ndx}`);
        const theName  = misc.canonicalizeName(name);
        // Separate the phone numbers by ;, space or new lines
        const thePhone = misc.canonicalizePhone(phones.split(/[;,\s\n\r]/)[0]);
        if( thePhone.length<1 ) {
            acc.warns.push(`Found '${name}' in row #${ndx} not having a phone. Skipping...`);
            return acc;
        }
        const description = r.get("Description");
        // @ts-expect-error
        acc.json.destinations.push({
            'type'      :   'number',
            number      :   `+1${thePhone}`,
            message     :   `I am forwarding your call to ${theName}. Please stay on the line`,
            description :   description ? `${theName} - ${description}` : theName
        });
        // TODO:
        // Make the phone unique
        const fullPhone     = `+1${thePhone}`;
        const theFunction   = acc.json['function']!;
        if( !theFunction.parameters!.properties!.destination!.enum!.includes(fullPhone) )
            theFunction.parameters!.properties!.destination!.enum!.push(fullPhone);
        acc.json.messages!.push({
            'type'      : 'request-start',
            content     : `I am forwarding your call to ${theName}. Please stay on the line`,
            conditions  : [{
                param   : 'destination',
                operator: 'eq',
                // @ts-expect-error
                value   : fullPhone
            }]
        });
        acc.prompt.push(`If the user asks for ${theName}, call combinedTransferCall with +1${thePhone}`);
        return acc;
    },{
        json    : {
            type            : "transferCall" as "function", // This is a typescript hack
            destinations    : [],
            'function'      : {
                name        : "combinedTransferCall",
                description : "Use this function to transfer the call to various contacts across different departments",
                parameters      : {
                    type        : "object",
                    properties  : {
                        destination : {
                            type        : 'string',
                            'enum'      : [],
                            description : 'The destination phone number for the call transfer'
                        }
                    },
                    required    : [
                        "destination"
                    ]
                },
            },
            messages        : []
        } as Vapi.CreateFunctionToolDto,
        prompt  : [] as string[],
        warns   : [] as string[]
    });
}

export const find_tool_by_name = ( vapi_client:VapiClient, name:string ) : Promise<Vapi.ToolsListResponseItem|undefined> => {
    if( !name )
        throw Error(`name should be provided`);
    return vapi_client.tools.list().then( tools => {
        return tools.find(t=>(t['function']?.name===name));
    })
}

export const list_tools = () => {
    return get_vapi_client().tools.list().then( tools => {
        return tools.map( t => {
            return {
                id : t.id,
                'function.name' : t['function']?.name
            }
        });
    });
}

export const create_transfer_call = () => {
    return get_transfer_call_payload().then( payload => {
        return get_vapi_client().tools.create(payload.json);
    });
}

export const create_dispatch_call = () => {
    return get_vapi_client().tools.create(get_dispatch_call_payload());
}

export const update_transfer_call = () => {
    return get_transfer_call_payload().then( payload => {
        const vapi_client = get_vapi_client();
        return find_tool_by_name(vapi_client,payload['function']!.name).then( t => {
            if( !t )
                throw Error(`Cannot find tool with name '${payload['function']!.name}'`);
            // @ts-expect-error
            delete payload.type;
            return vapi_client.tools.update(t.id,payload.json)
        });
    });
}

export const update_dispatch_call = () => {
    const vapi_client   = get_vapi_client();
    const payload       = get_dispatch_call_payload() as Vapi.ToolsUpdateRequest;
    return find_tool_by_name(vapi_client,payload['function']!.name).then( t => {
        if( !t )
            throw Error(`Cannot find tool with name '${payload['function']!.name}'`);
        // @ts-expect-error
        delete payload.type;
        return vapi_client.tools.update(t.id,payload)
    });
}

export const get = ( id:string ) : Promise<Vapi.ToolsGetResponse> => {
    return get_vapi_client().tools.get(id);
}
