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
        return tools.create_dispatch_call;
    if( name==='createTransferCall' )
        return tools.create_transfer_call;
    if( name==='updateDispatchCall' )
        return tools.update_dispatch_call;
    if( name==='updateTransferCall' )
        return tools.update_transfer_call;
    if( name==='getTool' )
        return () => {
            return tools.get(argv[3]);
        };
    if( name==='listTools' )
        return tools.list_tools;
    return () => {
        return Promise.reject(Error(`Unknown tool '${name}'`));
    }
}

getMain(process.argv)().then(console.log).catch(console.error);
