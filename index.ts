import commandLineArgs  from 'command-line-args';

import * as consts      from './consts';
import * as misc        from './misc';
import * as intempus    from './intempus';
import {
    VapiApi
}                       from './VapiApi';

const getMain = ( argv:commandLineArgs.CommandLineOptions ) => {

    const cmd           = argv.cmd;
    const vapiApi       = new VapiApi();
    const tools         = vapiApi.getTools();
    const assistants    = vapiApi.getAssistants();

    // Commands to manage tools
    if( cmd==='getToolById' )
        return (() => tools.get(argv.id));
    if( cmd==='getToolByName' )
        return (() => tools.getByName(argv.name));
    if( cmd==='listTools' )
        return (async () => {
            return (await tools.list()).map( t => {
                return {
                    id : t.id,
                    'function.name' : t['function']?.name
                }
            });
        });
    if( cmd==='createDispatchCallTool' )
        return  (() => {
            return tools.create(intempus.getDispatchCallPayload());
        });
    if( cmd==='createRedirectCallTool' )
        return (async () => {
            return tools.create(intempus.getRedirectCallTool(await misc.getContacts(process.env.CONTACTS_SHEET_NAME)));
        });
    if( cmd==='updateDispatchCallTool' )
        return (() => {
            return tools.updateByName(intempus.getDispatchCallPayload());
        });
    if( cmd==='updateRedirectCallTool' )
        return (async () => {
            return tools.updateByName(intempus.getRedirectCallTool(await misc.getContacts(process.env.CONTACTS_SHEET_NAME)));
        });
    // Commands to manage assistants
    if( cmd==='getAssistantById' )
        return (() => assistants.get(argv.id));
    if( cmd==='getAssistantByName' )
        return (() => assistants.getByName(argv.name));
    if( cmd==='listAssistants' )
        return (async () => {
            return (await assistants.list()).map( a => {
                return {
                    id      : a.id,
                    name    : a.name
                }
            });
        });
    if( cmd==='createIntempusAssistant' )
        return (async () => {
            const [
                contacts,
                existingAssistant,
                existingTools,
            ] = await Promise.all([
                misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
                assistants.getByName(consts.assistantName),
                tools.list(),
            ]);
            return assistants.create(intempus.getAssistant(contacts,existingAssistant,existingTools));
        });
    if( cmd==='updateIntempusAssistant' )
        return (async () => {
            const [
                contacts,
                existingAssistant,
                existingTools,
            ] = await Promise.all([
                misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
                assistants.getByName(consts.assistantName),
                tools.list(),
            ]);
            return assistants.updateByName(intempus.getAssistant(contacts,existingAssistant,existingTools));
        });
    if( cmd==='updateIntempusAssistantAndRedirectCallTool' )
        return (async () => {
            const [
                contacts,
                existingAssistant,
                existingTools
            ] = await Promise.all([
                misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
                assistants.getByName(consts.assistantName),
                tools.list()
            ]);
            return Promise.all([
                assistants.updateByName(intempus.getAssistant(contacts,existingAssistant,existingTools)),
                tools.updateByName(intempus.getRedirectCallTool(contacts))
            ]);
        });
    // Nothing is found
    return () => {
        return Promise.reject(Error(`Unknown tool '${cmd}'`));
    }
}

const argv = commandLineArgs([
    { name : 'cmd'      , alias: 'c', type: String },
    { name : 'id'       , alias: 'i', type: String },
    { name : 'name'     , alias: 'n', type: String },
    { name : 'stringify', alias: 's', type: Boolean },
]);
getMain(argv)().then( r => {
    if( argv.stringify )
        return console.log(JSON.stringify(r));
    return console.log(r);
}).catch(console.error);
