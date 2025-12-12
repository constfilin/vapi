import {
    VapiClient,
    Vapi,
}                               from '@vapi-ai/server-sdk';
import jwt                      from 'jsonwebtoken';

import * as Config              from './Config';
import * as misc                from './misc';

const dummyVapiClient = {} as VapiClient;
type MyTools = (typeof dummyVapiClient.tools) & {
    getByName( name?:string ) : Promise<Vapi.ListToolsResponseItem|undefined>;
    listByName() : Promise<Record<string,Vapi.ListToolsResponseItem>>;
    credate( payload:Vapi.CreateToolsRequest, tool:(Vapi.ListToolsResponseItem|undefined) ) : Promise<Vapi.ListToolsResponseItem>;
}
type MyAssistants = (typeof dummyVapiClient.assistants) & {
    getByName( name?:string ) : Promise<Vapi.Assistant|undefined>;
    listByName() : Promise<Record<string,Vapi.Assistant>>;
    credate( payload:Vapi.CreateAssistantDto, assistant:(Vapi.Assistant|undefined) ) : Promise<Vapi.Assistant>;
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
        const guessToolName = ( t:(Vapi.ListToolsResponseItem|Vapi.UpdateToolsRequestBody|Vapi.CreateToolsRequest) ) => {
            // @ts-expect-error
            return t.name||t['function']?.name;
        }
        tools.getByName = ( name?:string ) : Promise<Vapi.ListToolsResponseItem|undefined> => {
            if( !name )
                throw Error(`name should be provided`);
            return tools.list().then( tools => {
                return tools.find(t=>(guessToolName(t)===name));
            });
        }
        tools.listByName = () : Promise<Record<string,Vapi.ListToolsResponseItem>> => {
            return tools.list().then( existingTools => {
                return existingTools.reduce( (acc,t) => {
                    acc[guessToolName(t)] = t;
                    return acc;
                },{} as Record<string,Vapi.ListToolsResponseItem>);
            });
        }
        tools.credate = ( payload:Vapi.CreateToolsRequest, tool:(Vapi.ListToolsResponseItem|undefined) ) : Promise<Vapi.ListToolsResponseItem> => {
            return tool ? tools.update({
                id   : tool.id,
                body : misc.deleteKey(payload,'type')
            }) : tools.create(payload)
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
        assistants.listByName = () : Promise<Record<string,Vapi.Assistant>> => {
            return assistants.list().then( existingAssistants => {
                return existingAssistants.reduce( (acc,a) => {
                    acc[a.name] = a;
                    return acc;
                },{} as Record<string,Vapi.Assistant>);
            });
        }
        assistants.credate = ( payload:Vapi.CreateAssistantDto, assistant:(Vapi.Assistant|undefined) ) : Promise<Vapi.Assistant> => {
            return assistant ? assistants.update({
                id : assistant.id,
                ...misc.deleteKey(payload,'isServerUrlSecretSet')
            }) : assistants.create(payload)
        };
        return assistants;
    }
}
