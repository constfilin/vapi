import * as intempus        from './intempus/';
import * as Contacts        from './Contacts';
import { VapiApi }          from './VapiApi';

import * as VapeApi         from './api/VapeApi';

export const getCmdPromise = ( args:Record<string,any> ) => {

    const vapiApi       = new VapiApi();
    const tools         = vapiApi.getTools();
    const assistants    = vapiApi.getAssistants();
    const squads        = vapiApi.getSquads();
    const structuredOutputs = vapiApi.getStructuredOutputs();

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
    case 'getUserByPhone':
        return (() => VapeApi.getUserByPhone(
            args.sessionId as string,
            args.phoneNumber as string
        ));
    case 'getFAQAnswer':
        return (() => VapeApi.getFAQAnswer(
            args.sessionId   as string,
            args.question as string
        ));
    case 'getToolById':
        return (() => tools.get({id:args.id}));
    case 'getTool':
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
        return (() => assistants.get({id:args.id}));
    case 'getAssistant':
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
        return (() => squads.get({id:args.id}));
    case 'getSquad':
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
    case 'getStructuredOutputById':
        return (() => structuredOutputs.structuredOutputControllerFindOne({id:args.id}));
    case 'getStructuredOutput':
    case 'getStructuredOutputByName':
        return (() => structuredOutputs.getByName(args.name));
    case 'listStructuredOutputs':
        return (async () => {
            const response = await structuredOutputs.structuredOutputControllerFindAll();
            return (response.results || []).map( so => {
                return {
                    id          : so.id,
                    name        : so.name,
                    description : so.description
                }
            });
        });
    case 'credateTool':
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
    case 'credateAssistant':
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
    case 'credateSquad':
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
    case 'credateStructuredOutput':
        return  (async () => {
            const [
                contacts,
                assistantsByName,
                existingStructuredOutput,
            ] = await Promise.all([
                Contacts.get(),
                assistants.listByName(),
                structuredOutputs.getByName(args.name),
            ]);
            return structuredOutputs.credate(
                intempus.structuredOutputsByName[args.name](contacts, assistantsByName),
                existingStructuredOutput
            );
        });
    case 'credateTools':
        return (async () => {
            const [ 
                contacts,
                toolsByName
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
            ]);
            return Promise.all(
                Object.entries(intempus.toolsByName).map( ([toolName,getToolDto]) => {
                    return tools.credate(
                        getToolDto(contacts),
                        toolsByName[toolName]
                    );
                })
            );
        });
    case 'credateAssistants':
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
            return Promise.all(
                Object.entries(intempus.assistantsByName).map( ([assistantName,getAssistantDto]) => {
                    return assistants.credate(
                        getAssistantDto(contacts,toolsByName,undefined),
                        assistantsByName[assistantName]
                    );
                })
            );
        });
    case 'credateSquads':
        return (async () => {
            const [
                assistantsByName,
                squadsByName
            ] = await Promise.all([
                assistants.listByName(),
                squads.listByName(),
            ]);
            return Promise.all(
                Object.entries(intempus.squadsByName).map( ([squadName,getSquadDto]) => {
                    return squads.credate(
                        getSquadDto(assistantsByName),
                        squadsByName[squadName]
                    );
                })
            );
        });
    case 'credateStructuredOutputs':
        return (async () => {
            const [
                contacts,
                assistantsByName,
                structuredOutputsByName
            ] = await Promise.all([
                Contacts.get(),
                assistants.listByName(),
                structuredOutputs.listByName(),
            ]);
            return Promise.all(
                Object.entries(intempus.structuredOutputsByName).map( ([outputName,getOutputDto]) => {
                    return structuredOutputs.credate(
                        getOutputDto(contacts, assistantsByName),
                        structuredOutputsByName[outputName]
                    );
                })
            );
        });
    case 'credateAll':
        return (async () => {
            const [
                contacts,
                toolsByName,
                assistantsByName,
                squadsByName,
                structuredOutputsByName
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                assistants.listByName(),
                squads.listByName(),
                structuredOutputs.listByName(),
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
                }),
                ...Object.entries(intempus.structuredOutputsByName).map( ([outputName,getOutputDto]) => {
                    return structuredOutputs.credate(
                        getOutputDto(contacts, assistantsByName),
                        structuredOutputsByName[outputName]
                    );
                })
            ]);
        });
    case 'getCallSuccessRate':
        return (() => vapiApi.getCallSuccessRate(args.id));
    case 'getAverageCallSuccessRate':
        return (() => vapiApi.getAverageCallSuccessRate(args.limit));
    case 'getCallStructuredOutputs':
        return (() => vapiApi.getCallStructuredOutputs(args.id));
    case 'listCalls':
        return (() => vapiApi.listCalls(args.limit));
    }
    // Nothing is found
    return () => {
        return Promise.reject(Error(`Unknown command '${args.cmd}'`));
    }
}

