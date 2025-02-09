import commandLineArgs  from 'command-line-args';

import * as consts      from './consts';
import * as misc        from './misc';
import * as tools       from './tools';
import * as assistants  from './assistants';
import * as intempus    from './intempus';

const getMain = ( argv:commandLineArgs.CommandLineOptions ) => {
    const cmd = argv.cmd;
    // Commands to manage tools
    if( cmd==='getToolById' )
        return (() => tools.getById(argv.id));
    if( cmd==='getToolByName' )
        return (() => tools.getByName(argv.name));
    if( cmd==='listTools' )
        return tools.list;
    if( cmd==='createDispatchCallTool' )
        return tools.createDispatchCall;
    if( cmd==='createRedirectCallTool' )
        return tools.createRedirectCall;
    if( cmd==='updateDispatchCallTool' )
        return tools.updateDispatchCall;
    if( cmd==='updateRedirectCallTool' )
        return tools.updateRedirectCall;
    // Commands to manage assistants
    if( cmd==='getAssistantById' )
        return (() => assistants.getById(argv.id));
    if( cmd==='getAssistantByName' )
        return (() => assistants.getByName(argv.name));
    if( cmd==='listAssistants' )
        return assistants.list;
    if( cmd==='createIntempusAssistant' )
        return assistants.createIntempusAssistant;
    if( cmd==='updateIntempusAssistant' )
        return assistants.updateIntempusAssistant;
    if( cmd==='updateIntempusAssistantAndRedirectCallTool' )
        return (async () => {
            const vapiClient = misc.getVapiClient();
            const [
                contacts,
                intempusAssistant,
                existingTools
            ] = await Promise.all([
                misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts'),
                assistants.findByName(vapiClient,consts.assistantName),
                vapiClient.tools.list()
            ]);
            return Promise.all([
                assistants.update(vapiClient,intempus.getAssistant(contacts,intempusAssistant,existingTools)),
                tools.update(vapiClient,intempus.getRedirectCallTool(contacts))
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
