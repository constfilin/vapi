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

export const toNumber = ( s:any, dflt:number ) : number => {
    return ((s=='') || isNaN(s)) ? dflt : Number(s);
}

export const jsonParse = ( s:string, defaultValue:Record<string,any> ) : Record<string,any> => {
    try {
        return JSON.parse(s);
    }
    catch( err ) {
        return defaultValue
    }
};
