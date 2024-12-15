import reconcile    from './reconcile';
import generate     from './generate';

const main = process.argv[2]==='reconcile' ? reconcile : generate; 
main().then(console.log).catch(console.error);
