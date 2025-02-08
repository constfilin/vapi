import {
    Vapi,
    VapiClient
}                       from '@vapi-ai/server-sdk';

import * as misc        from './misc';
import * as intempus    from './intempus';

export const findByName = ( vapiClient:VapiClient, name?:string ) : Promise<Vapi.Assistant|undefined> => {
    if( !name )
        throw Error(`name should be provided`);
    return vapiClient.assistants.list().then( assistants => {
        return assistants.find(a=>(a.name===name));
    })
}

export const update = ( vapiClient:VapiClient, payload:Vapi.CreateAssistantDto ) : Promise<Vapi.Assistant> => {
    return findByName(vapiClient,payload.name).then( a => {
        if( !a )
            throw Error(`Cannot find assistant with name '${payload.name}'`);
        // @ts-expect-error
        delete payload.isServerUrlSecretSet;
        return vapiClient.assistants.update(a.id,payload)
    });
} 

export const list = () => {
    return misc.getVapiClient().assistants.list().then( assistants => {
        return assistants.map( a => {
            return {
                id      : a.id,
                name    : a.name
            }
        });
    });
}

export const createIntempusAssistant = async () => {
    const vapiClient = misc.getVapiClient();
    const [
        contacts,
        tools
    ] = await Promise.all([
        misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
        vapiClient.tools.list()
    ]);
    return vapiClient.assistants.create(intempus.getAssistant(contacts,tools));
}

export const updateIntempusAssistant = async () => {
    const vapiClient = misc.getVapiClient();
    const [
        contacts,
        tools
    ] = await Promise.all([
        misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
        vapiClient.tools.list()
    ]);
    return update(vapiClient,intempus.getAssistant(contacts,tools));
}

export const getById = ( id?:string ) : Promise<Vapi.Assistant|undefined> => {
    if( !id )
        throw Error(`Id is required`);
    return misc.getVapiClient().assistants.get(id);
}

export const getByName = ( name?:string ) : Promise<Vapi.Assistant|undefined> => {
    if( !name )
        throw Error(`name should be provided`);
    return findByName(misc.getVapiClient(),name);
}

