import dotenv from 'dotenv';
dotenv.config();

export default {
    // common params
    spreadsheetId                   : (process.env.SPREADSHEETID||'[hidden]'),
    simulatedPhoneNumber          : (process.env.SIMULATED_PHONE_NUMBER || ''),
    googleApiKey                    : (process.env.GOOGLE_API_KEY||'[hidden]'),
    worksheetName                   : (process.env.WORKSHEET_NAME||'Contacts'),
    vapiOrgId                       : (process.env.VAPI_ORG_ID||'[hidden]'),
    vapiPrivateKey                  : (process.env.VAPI_PRIVATE_KEY||''),
    vapiToolSecret                  : (process.env.VAPI_TOOLS_SECRET||'[hidden]'),
    vapeApiToken                  : (process.env.VAPE_API_TOKEN||'[hidden]'),
    publicUrl                       : (process.env.PUBLIC_URL||'http://127.0.0.1:9876/api'),                          // https://demo.tectransit.com/api/vapi
    replPort                        : (process.env.REPL_PORT ? parseInt(process.env.REPL_PORT) : 1338),
    // global model defaults for assistants
    model                           : (process.env.MODEL || 'gemini-2.5-flash'),
    provider                        : (process.env.MODEL_PROVIDER || 'google'),
    // web server
    web                             : {
        path        : __dirname,
        loglevel    : process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : 2,           // defines verbosity
        port        : 9876,        // port to listen on
        // API authentication
        header_name : "x-secret",
    },
    // NodeMailer
    nm                              : {
        from   : "no-reply@intempus.net",
        host   : (process.env.MN_HOST||"smtp-legacy.office365.com"),
        secure : false,
        port   : 587,
        tls    : {
            "ciphers"            : "SSLv3",
            "rejectUnauthorized" : false
        },
        auth   : {
            "user" : (process.env.NM_AUTH_USER||"no-reply@intempus.net"),
            "pass" : (process.env.NM_AUTH_PASS||'')
        }
    },
};
