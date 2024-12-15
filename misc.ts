import * as GoogleSpreadsheet   from 'google-spreadsheet';
import { JWT }                  from 'google-auth-library';

export const getSheet = async ( apiKey:string, docId:string, sheetNdx:number=0 ) : Promise<GoogleSpreadsheet.GoogleSpreadsheetWorksheet> => {
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
    return doc.sheetsByIndex[sheetNdx];
}

export const canonicalizeName = ( s:string ) : string => {
    const m = s.trim().match(/^([^,]+),\s+(.+)$/);
    // Convert `Lastname, firstname` into `firstname lastname` and remove quotes
    return (m ? `${m[2]} ${m[1]}` : s)
        .replace(/'/g,'')
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
