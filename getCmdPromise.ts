import * as intempus    from './intempus/';
import * as Config      from './Config';
import * as Contacts    from './Contacts';
import { VapiApi }      from './VapiApi';

export const getCmdPromise = ( args:Record<string,any> ) => {

    const config        = Config.get();
    const cmd           = args.cmd;
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
    case 'createToolByName':
        return  (async () => {
            return tools.create(intempus.toolsByName[args.name](
                await Contacts.get()
            ));
        });
    case 'updateToolByName':
        return  (async () => {
            return tools.updateByName(intempus.toolsByName[args.name](
                await Contacts.get()
            ));
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
                toolsByName,
                existingAssistant,
            ] = await Promise.all([
                tools.listByName(),
                assistants.getByName(args.name),
            ]);
            return assistants.create(intempus.assistantsByName[args.name](
                await Contacts.get(),
                toolsByName,
                existingAssistant
            ));
        });
    case 'updateAssistantByName':
        return  (async () => {
            const [
                toolsByName,
                existingAssistant,
            ] = await Promise.all([
                tools.listByName(),
                assistants.getByName(args.name),
            ]);
            return assistants.updateByName(intempus.assistantsByName[args.name](
                await Contacts.get(),
                toolsByName,
                existingAssistant
            ));
        });
    case 'updateAll':
        return (async () => {
            const [
                contacts,
                toolsByName,
                existingAssistant
            ] = await Promise.all([
                Contacts.get(),
                tools.listByName(),
                assistants.getByName(args.name),
            ]);
            return Promise.all([
                assistants.updateByName(intempus.assistantsByName.IntempusBot(contacts,toolsByName,existingAssistant)),
                tools.updateByName(intempus.toolsByName.redirectCall(contacts)),
                tools.updateByName(intempus.toolsByName.dispatchCall(contacts)),
                tools.updateByName(intempus.toolsByName.sendEmail(contacts)),
                tools.updateByName(intempus.toolsByName.guessState(contacts)),
            ]);
        });
    }
    // Nothing is found
    return () => {
        return Promise.reject(Error(`Unknown command '${cmd}'`));
    }
}

