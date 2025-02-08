import * as GoogleSpreadsheet   from 'google-spreadsheet';
import { JWT }                  from 'google-auth-library';

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
