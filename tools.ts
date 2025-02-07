import jwt            from 'jsonwebtoken';
import { VapiClient } from '@vapi-ai/server-sdk';

export const get_token = () => {
    const payload = { orgId: (process.env.VAPI_ORG_ID||'52859bb9-27df-41ee-8c6d-c300c1c75bbd') };
    const key     = process.env.VAPI_PRIVATE_KEY||'';
    const options = { expiresIn: '1h' };
    return jwt.sign(payload,key,options);
}

export const get_vapi_client = () => {
    return (new VapiClient({ token: get_token() }));
}
export const list = () => {
    return get_vapi_client().tools.list();
}

export const create = () => {
    return get_vapi_client().tools.create({
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
    }).then( response => {
        if( response.status>=400 )
            return JSON.stringify({err:response.statusText});
        return response;
    }).catch( err => {
        //console.log(err);
        throw err;
    })
}

export const get = () => {
    return Promise.reject(Error(`Not implemented`));
}
