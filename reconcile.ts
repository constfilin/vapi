import { promises as fs }   from 'node:fs';
import * as consts          from './consts';
import * as misc            from './misc';

const original_file = async () : Promise<Record<string,{phones:string[],emails:string[]}>> => {
    const sheet = await misc.getSheet(consts.apiKey,consts.spreadsheetId,0);
    return sheet.getRows({}).then( rows => {
        return rows.reduce( (acc,r,ndx) => {
            const name = r.get("Name");
            if( typeof name != 'string' )
                throw Error(`Name is missing in row #${ndx}`);
            const phones = r.get("Phones");
            if( typeof phones != 'string' )
                throw Error(`Phones is missing in row #${ndx}`);
            const emails = r.get("Emails");
            acc[misc.canonicalizeName(name)] = {
                phones : phones.split(',').map(misc.canonicalizePhone),
                emails : (emails||'').split(',').map(misc.canonicalizeEmail)
            };
            return acc;
        },{});
    });
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
                acc[misc.canonicalizeName(m[1])] = misc.canonicalizePhone(m[2]);
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
            const name = misc.canonicalizeName(d.message.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            const phone = misc.canonicalizePhone(d.number);
            acc.phoneByName[name] = phone;
            acc.nameByPhone[phone] = name;
            return acc;
        },{
            phoneByName : {} as Record<string,string>,
            nameByPhone : {} as Record<string,string>
        })
        const phones = json['function'].parameters.properties.destination.enum.reduce( (acc,p) => {
            const phone = misc.canonicalizePhone(p);
            //if( !destinations.nameByPhone[phone] )
            //    throw Error(`Phone '${phone}' does not exist in JSON file destinations`);
            acc[phone] = true;
            return acc;
        },{} as Record<string,boolean>);
        const messages = json.messages.reduce((acc,m) => {
            const name = misc.canonicalizeName(m.content.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            //if( !destinations.phoneByName[name] )
            //    throw Error(`Name '${name}' does not exist in JSON file destinations`);
            acc[name] = misc.canonicalizePhone(m.conditions[0].value);
            return acc;
        },{} as Record<string,string>);
        return {
            phoneByName : destinations.phoneByName,
            nameByPhone : destinations.nameByPhone,
            phones,
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
            const [name,{phones,emails}] = original;
            if( !systemPrompt[name] ) {
                warns.push(`Name '${name}' does not exist in system prompt`);
            }
            else if( !phones.includes(systemPrompt[name]) ) {
                warns.push(`For name '${name}' phone # in system prompt '${systemPrompt[name]}' does not match that in original file '${phones}'`);
            }
            if( !json.phoneByName[name] ) {
                warns.push(`Name '${name}' does not exist in JSON file`);
            }
            else if( !phones.includes(json.phoneByName[name]) ) {
                warns.push(`For name '${name}' phone # in JSON file '${json.phoneByName[name]}' does not match that in original file '${phones}'`);
            }
            //console.log({
            //    name,
            //    phones,
            //    emails,
            //    systemPhone : systemPrompt[name],
            //    jsonPhone : json.phoneByName[name]
            //});
            return warns;
        },[] as string[]);
    });
}

export default reconcile;
