import * as intempus    from './intempus/';
import * as Contacts    from './Contacts';
import { VapiApi }      from './VapiApi';

import { getFAQAnswer }     from './api/getFAQAnswer';
import { getUserFromPhone } from './api/getUserFromPhone';

export const getCmdPromise = ( args:Record<string,any> ) => {

    const vapiApi       = new VapiApi();
    const tools         = vapiApi.getTools();
    const assistants    = vapiApi.getAssistants();
    const squads        = vapiApi.getSquads();

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
    case 'getUserFromPhone':
        return (() => getUserFromPhone(
            args.sessionId as string,
            args.phoneNumber as string
        ));
    case 'getFAQAnswer':
        return (() => getFAQAnswer(
            args.sessionId   as string,
            args.question as string
        ));
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
    case 'getSquadById':
        return (() => squads.get(args.id));
    case 'getSquadByName':
        return (() => squads.getByName(args.name));
    case 'listSquads':
        return (async () => {
            return (await squads.list()).map( s => {
                return {
                    id      : s.id,
                    name    : s.name
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
    case 'credateSquadByName':
        return  (async () => {
            const [
                assistantsByName,
                existingSquad,
            ] = await Promise.all([
                assistants.listByName(),
                squads.getByName(args.name),
            ]);
            return squads.credate(
                intempus.squadsByName[args.name](assistantsByName),
                existingSquad
            );
        });
    case 'credateAll':
        return (async () => {
            const [
                contacts,
                toolsByName,
                assistantsByName,
                squadsByName
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                assistants.listByName(),
                squads.listByName(),
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
                }),
                ...Object.entries(intempus.squadsByName).map( ([squadName,getSquadDto]) => {
                    return squads.credate(
                        getSquadDto(assistantsByName),
                        squadsByName[squadName]
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

