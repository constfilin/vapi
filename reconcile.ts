import * as GoogleSpreadsheet   from 'google-spreadsheet';
import { JWT }                  from 'google-auth-library';

import { promises as fs } from 'node:fs';

const canonicalizeName = ( s:string ) : string => {
    const m = s.trim().match(/^([^,]+),\s+(.+)$/);
    // Convert `Lastname, firstname` into `firstname lastname` and remove quotes
    return (m ? `${m[2]} ${m[1]}` : s).replace(/'/g,'').toLowerCase();
}

const canonicalizePhone = ( s:string ) : string => {
    s = s.trim().replace(/[^0-9]/g,'');
    return (s.length>10 && s[0]=='1') ? s.substring(1) : s;
}

const canonicalizeEmail = ( s:string ) : string => {
    return s.trim().toLowerCase();
}

const original_file = async () : Record<string,{phones:string[],emails:string[]}> => {
    const jwt = new JWT({
        //email   : auth.client_email,
        //key     : auth.private_key,
        apiKey  : 'AIzaSyCT8aFJSkW441NeZcm-4ZJrE3jT0iIkzgo',
        scopes  : [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
        ]
    });
    const doc = new GoogleSpreadsheet.GoogleSpreadsheet('1m1nzQ1TBnx9HS1uIv3zMqkAdn2ZbQo9YLceeKzVgVWA',jwt);
    await doc.loadInfo();
    const firstSheet = doc.sheetsByIndex[0];
    return firstSheet.getRows({}).then( rows => {
        return rows.reduce( (acc,r,ndx) => {
            const name = r.get("Name");
            if( typeof name != 'string' )
                throw Error(`Name is missing in row #${ndx}`);
            const phones = r.get("Phones");
            if( typeof phones != 'string' )
                throw Error(`Phones is missing in row #${ndx}`);
            const emails = r.get("Emails");
            acc[canonicalizeName(name)] = {
                phones : phones.split(',').map(canonicalizePhone),
                emails : (emails||'').split(',').map(canonicalizeEmail)
            };
            return acc;
        },{});
    });
}

const system_prompt = async () : Record<string,string> => {
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
                acc[canonicalizeName(m[1])] = canonicalizePhone(m[2]);
                return acc;
            },{});
    });
}

const json_file = async () : Record<string,Record<string,any>> => {
    return import('/home/cf/Downloads/updated_transfer_call_function.json').then( json => {
        if( !Array.isArray(json.destinations) )
            return Error(`destinations is not an array`);
        if( !json['function'] )
            return Error(`function is not found`);
        if( !Array.isArray(json.messages) )
            return Error(`messages is not an array`);
        const destinations = json.destinations.reduce( (acc,d) => {
            const name = canonicalizeName(d.message.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            const phone = canonicalizePhone(d.number);
            acc.phoneByName[name] = phone;
            acc.nameByPhone[phone] = name;
            return acc;
        },{
            phoneByName : {},
            nameByPhone : {}
        })
        const phones = json['function'].parameters.properties.destination.enum.reduce( (acc,p) => {
            const phone = canonicalizePhone(p);
            //if( !destinations.nameByPhone[phone] )
            //    throw Error(`Phone '${phone}' does not exist in JSON file destinations`);
            acc[phone] = true;
            return acc;
        },{});
        const messages = json.messages.reduce((acc,m) => {
            const name = canonicalizeName(m.content.replace(/^.+forwarding\s+your\s+call\s+to\s+([^.]+)\..+$/,"$1"));
            //if( !destinations.phoneByName[name] )
            //    throw Error(`Name '${name}' does not exist in JSON file destinations`);
            acc[name] = canonicalizePhone(m.conditions[0].value);
            return acc;
        },{});
        return {
            phoneByName : destinations.phoneByName,
            nameByPhone : destinations.nameByPhone,
            phones,
            messages
        };
    });
}

const reconcile = () : string[] => {
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
        },[]);
    });
}

export default reconcile;
