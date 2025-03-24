import {
    VapiClient,
    Vapi,
}                               from '@vapi-ai/server-sdk';
import jwt                      from 'jsonwebtoken';

import * as Config              from './Config';


const dummyVapiClient = {} as VapiClient;
type MyTools = (typeof dummyVapiClient.tools) & {
    getByName( name?:string ) : Promise<Vapi.ToolsListResponseItem|undefined>;
    updateByName( payload:Vapi.ToolsCreateRequest ) : Promise<Vapi.ToolsUpdateResponse>;
}
type MyAssistants = (typeof dummyVapiClient.assistants) & {
    getByName( name?:string ) : Promise<Vapi.Assistant|undefined>;
    updateByName( payload:Vapi.CreateAssistantDto ) : Promise<Vapi.Assistant>
}

export class VapiApi extends VapiClient {
    constructor() {
        const config  = Config.get();
        const payload = { orgId: config.vapiOrgId };
        const key     = config.vapiPrivateKey;
        const options = { expiresIn: '30m' };
        // @ts-expect-error
        const token = jwt.sign(payload,key,options);
        // See https://discord.com/channels/1211482211119796234/1353414660212391937/1353415037166944412
        // Looks like the token authentication is broken
        super({ token: config.vapiPrivateKey });
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
                return super.tools.update(t.id,payload);
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
            });
        };
        assistants.updateByName = ( payload:Vapi.CreateAssistantDto ) : Promise<Vapi.Assistant> => {
            return assistants.getByName(payload.name).then( a => {
                if( !a )
                    throw Error(`Cannot find assistant with name '${payload.name}'`);
                // @ts-expect-error
                delete payload.isServerUrlSecretSet;
                return super.assistants.update(a.id,payload);
            });
        };
        return assistants;
    }
}
