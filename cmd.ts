import commandLineArgs      from 'command-line-args';
import { getCmdPromise }    from './getCmdPromise';
import Server               from './Server';

const cmd = () => {
    const argv = commandLineArgs([
        { name : 'cmd'          , alias: 'c', type: String },
        { name : 'id'           , alias: 'i', type: String },
        { name : 'name'         , alias: 'n', type: String },
        { name : 'stringify'    , alias: 's', type: Boolean },
        { name : 'sessionId'    ,             type: String },
        { name : 'phoneNumber'  , alias: 'p', type: String },
        { name : 'question'     , alias: 'q', type: String },
        { name : 'callId'       , alias: 'k', type: String },
        { name : 'limit'        , alias: 'l', type: Number },
    ]);
    // Needed for log initialization.
    const server = new Server();
    getCmdPromise(argv)()
        .then( r => {
            if( argv.stringify )
                return console.log(JSON.stringify(r,null,4));
            return console.log(r);
        })
        .catch( (err) => {
            console.error(err);
            process.exit(-1);
        })
        .finally(() => {
            process.exit(0);
        });
}

cmd();
