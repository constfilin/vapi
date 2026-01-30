import commandLineArgs  from 'command-line-args';
import { getCmdPromise } from './getCmdPromise';

const cmd = () => {
    const argv = commandLineArgs([
        { name : 'cmd'          , alias: 'c', type: String },
        { name : 'id'           , alias: 'i', type: String },
        { name : 'name'         , alias: 'n', type: String },
        { name : 'stringify'    , alias: 's', type: Boolean },
        { name : 'sessionId'    ,             type: String },
        { name : 'phoneNumber'  , alias: 'p', type: String },
        { name : 'question'     , alias: 'q', type: String },
    ]);
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
