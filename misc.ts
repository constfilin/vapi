import * as GoogleSpreadsheet   from 'google-spreadsheet';
import { JWT }                  from 'google-auth-library';

import * as consts              from './consts';

export const canonicalizePersonName = ( s:string ) : string => {
    const m = s.trim().match(/^([^,]+),\s+(.+)$/);
    // Convert `Lastname, firstname` into `firstname lastname` and remove quotes
    return (m ? `${m[2]} ${m[1]}` : s)
        .replace(/'/g,'')
        .replace(/\s+/g,' ')
        .toLowerCase()
        .split(' ')
        // Capitalize the fist letter
        .map( s => `${s[0].toUpperCase()}${s.substring(1)}`)
        .join(' ');
}

export const canonicalizePhone = ( s:string ) : string => {
    s = s.trim().replace(/[^0-9]/g,'');
    return (s.length>10 && s[0]=='1') ? s.substring(1) : s;
}

export const canonicalizeEmail = ( s:string ) : string => {
    return s.trim().toLowerCase();
}

export const getSheet = async ( apiKey:string, docId:string, sheetName:string ) : Promise<GoogleSpreadsheet.GoogleSpreadsheetWorksheet|undefined> => {
    const jwt = new JWT({
        //email   : auth.client_email,
        //key     : auth.private_key,
        apiKey,
        scopes  : [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
        ]
    });
    const doc = new GoogleSpreadsheet.GoogleSpreadsheet(docId,jwt);
    await doc.loadInfo();
    sheetName = sheetName.toLowerCase();
    return doc.sheetsByIndex.find(ws => {
        return ws.title.toLowerCase()===sheetName;
    });
}

export interface Contact {
    name            : string;
    description     : (string|undefined);
    phoneNumbers    : string[];
    emailAddresses  : string[];
}

export const getContacts = async (
    sheetName   : (string|undefined),
    warns?      : string[]
 ) : Promise<Contact[]> => {
    const sheet = await getSheet(consts.apiKey,consts.spreadsheetId,sheetName||'Contacts');
    if( !sheet )
        throw Error(`Cannot find sheet '${sheetName}'`);
    if( !warns )
        warns = [];
    return sheet.getRows({}).then( rows => {
        return rows.reduce( (acc,r,ndx)  => {
            const name = r.get("Name");
            if( typeof name != 'string' ) {
                warns.push(`Name is missing in row #${ndx}`);
                return acc;
            }
            const phones = r.get("PhoneNumber")||'';
            // Separate the phone numbers by ;, space or new lines
            const phoneNumbers = phones.split(/[;,\s\n\r]/).map(canonicalizePhone);
            if( phoneNumbers.length<1 || (phoneNumbers[0]?.length||0)<1 ) {
                warns.push(`Found '${name}' in row #${ndx} not having a phone. Skipping...`);
                return acc;
            }
            const emails = r.get("EmailAddresses")||'';
            const emailAddresses = emails.split(/[;,\s\n\r]/).map(canonicalizeEmail);
            acc.push({
                name         : canonicalizePersonName(name),
                description  : r.get("Description"),
                phoneNumbers,
                emailAddresses
            });
            return acc;
        },[] as Contact[]);
    });
}
