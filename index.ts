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
    switch( argv.cmd ) {
    case 'getToolById':
        return (() => tools.get(argv.id));
    case 'getToolByName':
        return (() => tools.getByName(argv.name));
    case 'listTools':
        return (async () => {
            return (await tools.list()).map( t => {
                return {
                    id : t.id,
                    'function.name' : t['function']?.name
                }
            });
        });
    case 'createToolByName':
        return  (async () => {
            return tools.create(await intempus.getToolByName(argv.name));
        });
    case 'updateToolByName':
        return  (async () => {
            return tools.updateByName(await intempus.getToolByName(argv.name));
        });
    case 'getAssistantById':
        return (() => assistants.get(argv.id));
    case 'getAssistantByName':
        return (() => assistants.getByName(argv.name));
    case 'listAssistants':
        return (async () => {
            return (await assistants.list()).map( a => {
                return {
                    id      : a.id,
                    name    : a.name
                }
            });
        });
    case 'createAssistantByName':
        return  (async () => {
            const [
                existingAssistant,
                existingTools,
            ] = await Promise.all([
                assistants.getByName(consts.assistantName),
                tools.list(),
            ]);
            return assistants.create(await intempus.getAssistantByName(argv.name,existingAssistant,existingTools));
        });
    case 'updateAssistantByName':
        return  (async () => {
            const [
                existingAssistant,
                existingTools,
            ] = await Promise.all([
                assistants.getByName(consts.assistantName),
                tools.list(),
            ]);
            return assistants.updateByName(await intempus.getAssistantByName(argv.name,existingAssistant,existingTools));
        });
    case 'updateAll':
        return (async () => {
            const [
                contacts,
                existingAssistant,
                existingTools
            ] = await Promise.all([
                misc.getCachedContacts(),
                assistants.getByName(consts.assistantName),
                tools.list()
            ]);
            return Promise.all([
                assistants.updateByName(intempus.getAssistant(contacts,existingAssistant,existingTools)),
                tools.updateByName(intempus.getRedirectCallTool(contacts)),
                tools.updateByName(intempus.getDispatchCallTool()),
                tools.updateByName(intempus.getSendEmailTool())
            ]);
        });
    }
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
