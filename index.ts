import reconcile from './reconcile';
import generate from './generate';

reconcile().then( warns => {
    console.log(warns);
}).catch( err => {
    console.error(err);
});
