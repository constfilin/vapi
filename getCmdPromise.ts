import * as intempus        from './intempus/';
import * as elevenLabs      from './elevenlabs';
import * as Contacts        from './Contacts';
import { VapiApi }          from './VapiApi';
import { ElevenLabsApi } from './ElevenLabsApi';

import * as VapeApi         from './api/VapeApi';

export const getCmdPromise = ( args:Record<string,any> ) => {

    const vapiApi       = new VapiApi();
    const elevenLabsApi = new ElevenLabsApi();
    const tools         = elevenLabsApi.getTools();
    const agents        = elevenLabsApi.getAgents();
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
        return (() => tools.get(args.id as string));
    case 'getTool':
    case 'getToolByName':
        return (() => tools.getByName(args.name));
    case 'listTools':
        return (async () => {
            return (await tools.list());
        });
    case 'getAgentById':
        return (() => agents.get(args.id));
    case 'getAgent':
    case 'getAgentByName':
        return (() => agents.getByName(args.name));
    case 'listAgents':
        return (() => agents.list());
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
                elevenLabs.toolsByName[args.name](contacts),
                existingTool
            );
        });
    case 'credateAgent':
        return  (async () => {
            const [
                contacts,
                toolsByName,
                existingAgent,
                agentsByName,
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                agents.getByName(args.name),
                agents.listByName(),
            ]);
            return agents.credate(
                elevenLabs.agentsByName[args.name](contacts,toolsByName, agentsByName),
                existingAgent
            );
        });
    case 'credateSquad':
        return  (async () => {
            const [
                assistantsByName,
                existingSquad,
            ] = await Promise.all([
                agents.listByName(),
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
                agents.listByName(),
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
                Object.entries(elevenLabs.toolsByName).map( ([toolName,getToolDto]) => {
                    return tools.credate(
                        getToolDto(contacts),
                        toolsByName[toolName]
                    );
                })
            );
        });
    case 'credateAgents':
        return (async () => {
            const [
                contacts,
                toolsByName,
                agentsByName,
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                agents.listByName(),
            ]);
            return Promise.all(
                Object.entries(elevenLabs.agentsByName).map( ([agentName,getAgentDto]) => {
                    return agents.credate(
                        getAgentDto(contacts,toolsByName, agentsByName),
                        agentsByName[agentName]
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
                agents.listByName(),
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
                agents.listByName(),
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
                agentsByName,
                squadsByName,
                structuredOutputsByName
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                agents.listByName(),
                squads.listByName(),
                structuredOutputs.listByName(),
            ]);
            return Promise.all([
                ...Object.entries(elevenLabs.agentsByName).map( ([agentName,getAgentDto]) => {
                    return agents.credate(
                        getAgentDto(contacts,toolsByName),
                        agentsByName[agentName]
                    );
                }),
                ...Object.entries(elevenLabs.toolsByName).map( ([toolName,getToolDto]) => {
                    return tools.credate(
                        getToolDto(contacts),
                        toolsByName[toolName]
                    );
                }),
                ...Object.entries(intempus.squadsByName).map( ([squadName,getSquadDto]) => {
                    return squads.credate(
                        getSquadDto(agentsByName),
                        squadsByName[squadName]
                    );
                }),
                ...Object.entries(intempus.structuredOutputsByName).map( ([outputName,getOutputDto]) => {
                    return structuredOutputs.credate(
                        getOutputDto(contacts, agentsByName),
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

