import * as intempus    from './intempus/';
import * as Contacts    from './Contacts';
import { VapiApi }      from './VapiApi';

export const getCmdPromise = ( args:Record<string,any> ) => {

    const vapiApi       = new VapiApi();
    const tools         = vapiApi.getTools();
    const assistants    = vapiApi.getAssistants();

    // Commands to manage tools
    switch( args.cmd ) {
    case 'listContacts':
        return (async () => {
            const warns = [] as string[];
            return {
                contacts : await Contacts.getRaw(warns),
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
    case 'credateToolByName':
        return  (async () => {
            const [
                contacts,
                existingTool,
            ] = await Promise.all([
                Contacts.get(),
                tools.getByName(args.name),
            ]);
            return tools.credate(
                intempus.toolsByName[args.name](contacts),
                existingTool
            );
        });
    case 'credateAssistantByName':
        return  (async () => {
            const [
                contacts,
                toolsByName,
                existingAssistant,
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                assistants.getByName(args.name),
            ]);
            return assistants.credate(
                intempus.assistantsByName[args.name](contacts,toolsByName,existingAssistant),
                existingAssistant
            );
        });
    case 'credateAll':
        return (async () => {
            const [
                contacts,
                toolsByName,
                assistantsByName
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                assistants.listByName(),
            ]);
            return Promise.all([
                ...Object.entries(intempus.assistantsByName).map( ([assistantName,getAssistantDto]) => {
                    return assistants.credate(
                        getAssistantDto(contacts,toolsByName,assistantsByName[assistantName]),
                        assistantsByName[assistantName]
                    );
                }),
                ...Object.entries(intempus.toolsByName).map( ([toolName,getToolDto]) => {
                    return tools.credate(
                        getToolDto(contacts),
                        toolsByName[toolName]
                    );
                })
            ]);
        });
    }
    // Nothing is found
    return () => {
        return Promise.reject(Error(`Unknown command '${args.cmd}'`));
    }
}

