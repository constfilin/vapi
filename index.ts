import util         from 'node:util';
import reconcile    from './reconcile';
import generate     from './generate';
import * as tools   from './tools';

const getMain = ( argv:string[] ) => {
    const name = argv[2];
    if( name==='reconcile' )
        return reconcile;
    if( name==='generate' )
        return generate;
    if( name==='createDispatchCall' )
        return tools.createDispatchCall;
    if( name==='createTransferCall' )
        return tools.createTransferCall;
    if( name==='updateDispatchCall' )
        return tools.updateDispatchCall;
    if( name==='updateTransferCall' )
        return tools.updateTransferCall;
    if( name==='getTool' )
        return () => {
            return tools.getById(argv[3]);
        };
    if( name==='getByName' )
        return () => {
            return tools.getByName(argv[3]);
        };
    if( name==='listTools' )
        return tools.list;
    return () => {
        return Promise.reject(Error(`Unknown tool '${name}'`));
    }
}

getMain(process.argv)().then(console.log).catch(console.error);
