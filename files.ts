import { promises as fs }   from 'node:fs';

import * as misc            from './misc';
import * as intempus        from './intempus';


const original_file = async () : Promise<Record<string,misc.Contact>> => {
    const warns = [] as string[];
    const contacts = await misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts',warns);
    if( warns.length>0 )
        throw Error(warns.join(";"));
    return contacts.reduce( (acc,r,ndx) => {
        acc[r.name] = r;
        return acc;
    },{});
}

const system_prompt = async () : Promise<Record<string,string>> => {
    return fs.readFile('./system_prompt.txt').then( b => {
        return b.toString()
            .split('\n')
            .map( s => {
                return s.match(/^.+user\s+asks\s+for\s+([^,]+),\s*call\s+(?:the\s+)?combinedTransferCall\s+with\s+\+?([0-9]+).+$/i);
            })
            .reduce( (acc,m) => {
                //console.log({m});
                if( !m )
                    return acc;
                acc[misc.canonicalizePersonName(m[1])] = misc.canonicalizePhone(m[2]);
                return acc;
            },{});
    });
}

const json_file = async () : Promise<Record<string,Record<string,any>>> => {
    return import('./updated_transfer_call_function.json').then( json => {
        if( !Array.isArray(json.destinations) )
            throw Error(`destinations is not an array`);
        if( !json['function'] )
            throw Error(`function is not found`);
        if( !Array.isArray(json.messages) )
            throw Error(`messages is not an array`);
        const destinations = json.destinations.reduce( (acc,d) => {
            const name = misc.canonicalizePersonName(d.message.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            const phone = misc.canonicalizePhone(d.number);
            acc.phoneByName[name] = phone;
            acc.nameByPhone[phone] = name;
            return acc;
        },{
            phoneByName : {} as Record<string,string>,
            nameByPhone : {} as Record<string,string>
        })
        const phoneNumbers = json['function'].parameters.properties.destination.enum.reduce( (acc,p) => {
            const phone = misc.canonicalizePhone(p);
            //if( !destinations.nameByPhone[phone] )
            //    throw Error(`Phone '${phone}' does not exist in JSON file destinations`);
            acc[phone] = true;
            return acc;
        },{} as Record<string,boolean>);
        const messages = json.messages.reduce((acc,m) => {
            const name = misc.canonicalizePersonName(m.content.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            //if( !destinations.phoneByName[name] )
            //    throw Error(`Name '${name}' does not exist in JSON file destinations`);
            acc[name] = misc.canonicalizePhone(m.conditions[0].value);
            return acc;
        },{} as Record<string,string>);
        return {
            phoneByName : destinations.phoneByName,
            nameByPhone : destinations.nameByPhone,
            phoneNumbers,
            messages
        };
    });
}

export const reconcile = () : Promise<string[]> => {
    return Promise.all([
        original_file(),
        system_prompt(),
        json_file()
    ]).then( ([original,systemPrompt,json]) => {
        //return systemPrompt;
        return Object.entries(original).reduce( (warns,original,ndx) => {
            const [name,contact] = original;
            if( !systemPrompt[name] ) {
                warns.push(`Name '${name}' does not exist in system prompt`);
            }
            else if( !contact.phoneNumbers.includes(systemPrompt[name]) ) {
                warns.push(`For name '${name}' phone # in system prompt '${systemPrompt[name]}' does not match that in original file '${contact.phoneNumbers}'`);
            }
            if( !json.phoneByName[name] ) {
                warns.push(`Name '${name}' does not exist in JSON file`);
            }
            else if( !contact.phoneNumbers.includes(json.phoneByName[name]) ) {
                warns.push(`For name '${name}' phone # in JSON file '${json.phoneByName[name]}' does not match that in original file '${contact.phoneNumbers}'`);
            }
            //console.log({
            //    name,
            //    phoneNumbers,
            //    emails,
            //    systemPhone : systemPrompt[name],
            //    jsonPhone : json.phoneByName[name]
            //});
            return warns;
        },[] as string[]);
    });
}

export const generate = async () => {
    const warns = [] as string[];
    const [
        contacts,
        tools
    ] = await Promise.all([
        misc.getContacts(process.env.CONTACTS_SHEET_NAME||'Contacts',warns),
        misc.getVapiClient().tools.list()
    ]);
    await Promise.all([
        fs.writeFile('./updated_transfer_call_function.json',JSON.stringify(intempus.getRedirectCallTool(contacts),null,4)),
        fs.writeFile('./system_prompt.txt',intempus.getAssistant(contacts,tools).model!.messages![0]!.content!)
    ]);
    return warns;
}
