import { promises as fs }   from 'node:fs';
import * as consts          from './consts';
import * as misc            from './misc';

type Destination = {
    type        : 'number';
    number      : string;
    message     : string;
    description : string;
}

type Function = {
    name        : "combinedTransferCall",
    description : "Use this function to transfer the call to various contacts across different departments",
    parameters      : {
        type        : "object",
        properties  : {
            destination : {
                type        : 'string',
                'enum'      : string[],
                description : 'The destination phone number for the call transfer'
            }
        },
        required    : string[]
    }
}

type Message = {
    'type'      : string;
    content     : string;
    conditions  : {
        param       : string;
        operator    : string;
        value       : string;
    }[];
}

type JSONType = {
    type            : "transferCall";
    destinations    : Destination[];
    'function'      : Function;
    messages        : Message[]
}

export const generate = async () => {
    const sheet = await misc.getSheet(consts.apiKey,consts.spreadsheetId,1);
    const rows  =  await sheet.getRows({});
    const warns = [] as string[];
    const {json,prompt} = rows.reduce((acc,r,ndx) => {
        const name = r.get("Name");
        if( typeof name != 'string' )
            throw Error(`Name is missing in row #${ndx}`);
        const phones = r.get("Phones");
        if( typeof phones != 'string' )
            throw Error(`Phones is missing in row #${ndx}`);
        const theName  = misc.canonicalizeName(name);
        // Separate the phone numbers by ;, space or new lines
        const thePhone = misc.canonicalizePhone(phones.split(/[;,\s\n\r]/)[0]);
        if( thePhone.length<1 ) {
            warns.push(`Found '${name}' in row #${ndx} not having a phone. Skipping...`);
            return acc;
        }
        const description = r.get("Description");
        acc.json.destinations.push({
            'type'      :   'number',
            number      :   `+1${thePhone}`,
            message     :   `I am forwarding your call to ${theName}. Please stay on the line`,
            description :   description ? `${theName} - ${description}` : theName
        });
        // TODO:
        // Make the phone unique
        const fullPhone = `+1${thePhone}`;
        if( !acc.json['function'].parameters.properties.destination.enum.includes(fullPhone) )
            acc.json['function'].parameters.properties.destination.enum.push(fullPhone);
        acc.json.messages.push({
            'type'      : 'request-start',
            content     : `I am forwarding your call to ${theName}. Please stay on the line`,
            conditions  : [{
                param   : 'destination',
                operator: 'eq',
                value   : fullPhone
            }]
        });
        acc.prompt.push(`If the user asks for ${theName}, call combinedTransferCall with +1${thePhone}`);
        return acc;
    },{
        json    : {
            type            : "transferCall",
            destinations    : [],
            'function'      : {
                name        : "combinedTransferCall",
                description : "Use this function to transfer the call to various contacts across different departments",
                parameters      : {
                    type        : "object",
                    properties  : {
                        destination : {
                            type        : 'string',
                            'enum'      : [],
                            description : 'The destination phone number for the call transfer'
                        }
                    },
                    required    : [
                        "destination"
                    ]
                },
            },
            messages        : []
        } as JSONType,
        prompt  : [] as string[]
    });
    await Promise.all([
        fs.writeFile('./updated_transfer_call_function.json',JSON.stringify(json,null,4)),
        fs.writeFile('./system_prompt.txt',prompt.join("\n"))
    ]);
    return warns;
}

export default generate;
