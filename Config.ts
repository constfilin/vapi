export interface Config {
    // common params
    spreadsheetId           : string;
    googleApiKey            : string;
    worksheetName           : string;
    vapiOrgId               : string;
    vapiPrivateKey          : string;
    vapiToolSecret          : string;
    assistantName           : string;
    publicUrl               : string;
    replPort                : number;
    web                     :   {
        path                :   string;
        loglevel            :   number;
        port                :   number;
        header_name         :   string;
        business_start_hour?:   number;
        business_end_hour?  :   number;
    },
    nm                      :   {
        from                : string;
        host                : string;
        secure              : boolean;
        port                : number;
        tls                 : {
            ciphers         : string;
            rejectUnauthorized : boolean;
        };
        auth                : { 
            user            : string;
            pass            : string;
        }
    };
}

let _config = undefined as (Config|undefined);

export const get = () : Config => {
    if( !_config ) {
        const config = require('./config.js').default;
        if( !config )
            throw Error(`Config is not provided`);
        if( config.web ) {
            if( !config.web.header_name || !config.vapiToolSecret )
                throw Error(`Authentication is not provided`);
            if( typeof config.web.port !== 'number' )
                throw Error('Port is not provided'); 
            if( typeof config.web.loglevel !== 'number' )
                config.web.loglevel = 1;
        }
        if( !config.nm )
            throw Error(`No nodemailer configuration`);
        _config = config;
    }
    return _config!;
}

export default Config;