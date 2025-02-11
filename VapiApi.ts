import {
    VapiClient,
    Vapi,
}                               from '@vapi-ai/server-sdk';
import jwt                      from 'jsonwebtoken';

import * as consts              from './consts';


const dummyVapiClient = {} as VapiClient;
type MyTools = (typeof dummyVapiClient.tools) & {
    getByName( name?:string ) : Promise<Vapi.ToolsListResponseItem|undefined>;
    updateByName( payload:Vapi.CreateFunctionToolDto ) : Promise<Vapi.ToolsUpdateResponse>;
}
type MyAssistants = (typeof dummyVapiClient.assistants) & {
    getByName( name?:string ) : Promise<Vapi.Assistant|undefined>;
    updateByName( payload:Vapi.CreateAssistantDto ) : Promise<Vapi.Assistant>
}

export class VapiApi extends VapiClient {
    constructor() {
        const payload = { orgId: consts.vapiOrgId };
        const key     = consts.vapiPrivateKey;
        const options = { expiresIn: '1h' };
        // @ts-expect-error
        const token = jwt.sign(payload,key,options);
        super({ token });
    }
    getTools() : MyTools {
        const tools = super.tools as MyTools;
        tools.getByName = ( name?:string ) : Promise<Vapi.ToolsListResponseItem|undefined> => {
            if( !name )
                throw Error(`name should be provided`);
            return tools.list().then( tools => {
                return tools.find(t=>(t['function']?.name===name));
            });
        }
        tools.updateByName = ( payload:Vapi.CreateFunctionToolDto ) : Promise<Vapi.ToolsUpdateResponse> => {
            return tools.getByName(payload['function']?.name).then( t => {
                if( !t )
                    throw Error(`Cannot find tool with name '${payload['function']!.name}'`);
                // @ts-expect-error
                delete payload.type;
                return super.tools.update(t.id,payload)
            });
        }
        return tools;
    }
    getAssistants() : MyAssistants {
        const assistants = super.assistants as MyAssistants;
        assistants.getByName = ( name?:string ) : Promise<Vapi.Assistant|undefined> => {
            if( !name )
                throw Error(`name should be provided`);
            return assistants.list().then( assistants => {
                return assistants.find(a=>(a.name===name));
            })
        }
        assistants.updateByName = ( payload:Vapi.CreateAssistantDto ) : Promise<Vapi.Assistant> => {
            return assistants.getByName(payload.name).then( a => {
                if( !a )
                    throw Error(`Cannot find assistant with name '${payload.name}'`);
                // @ts-expect-error
                delete payload.isServerUrlSecretSet;
                return super.assistants.update(a.id,payload)
            });
        }
        return assistants;
    }
} 

