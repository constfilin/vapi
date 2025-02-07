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
    if( name==='createTool' )
        return tools.create;
    if( name==='getTool' )
        return tools.get;
    if( name==='listTools' )
        return tools.list;
    return () => {
        return Promise.reject(Error(`Unknown tool '${name}'`));
    }
}

getMain(process.argv)().then(console.log).catch(console.error);
