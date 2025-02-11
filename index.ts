import commandLineArgs  from 'command-line-args';

import * as consts      from './consts';
import * as misc        from './misc';
import * as intempus    from './intempus';
import {
    VapiApi
}                       from './VapiApi';

const getMain = ( args:commandLineArgs.CommandLineOptions ) => {

    const cmd           = args.cmd;
    const vapiApi       = new VapiApi();
    const tools         = vapiApi.getTools();
    const assistants    = vapiApi.getAssistants();

    // Commands to manage tools
    switch( args.cmd ) {
    case 'listContacts':
        return (async () => {
            const warns = [] as string[];
            const contacts = await misc.getContacts(warns);
            return {
                contacts : Object.values(contacts
                    .map(c=>c.name.split(/\s+/))
                    .flat()
                    .reduce((acc,n) => {
                        const lower = n.toLowerCase();
                        if( ["a","an","the","for","to","on-call","by","of","main"].includes(lower) )
                            return acc;
                        acc[lower] = n;
                        return acc;
                    },{} as Record<string,string>)).map(n=>`${n}:30`),
                warns,
            };
        });
    case 'getToolById':
        return (() => tools.get(args.id));
    case 'getToolByName':
        return (() => tools.getByName(args.name));
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
            return tools.create(await intempus.getToolByName(args.name));
        });
    case 'updateToolByName':
        return  (async () => {
            return tools.updateByName(await intempus.getToolByName(args.name));
        });
    case 'getAssistantById':
        return (() => assistants.get(args.id));
    case 'getAssistantByName':
        return (() => assistants.getByName(args.name));
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
            return assistants.create(await intempus.getAssistantByName(args.name,existingAssistant,existingTools));
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
            return assistants.updateByName(await intempus.getAssistantByName(args.name,existingAssistant,existingTools));
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
