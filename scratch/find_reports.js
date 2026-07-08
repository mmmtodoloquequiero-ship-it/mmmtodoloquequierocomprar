const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes("{view === 'reports' && (() => {"));

if (start !== -1) {
    let open = 0;
    let end = -1;
    for (let i = start; i < lines.length; i++) {
        open += lines[i].split('{').length - 1;
        open -= lines[i].split('}').length - 1;
        if (open === 0 && i > start) {
            end = i;
            break;
        }
    }
    
    // Config ends just before `export default AdminTab;` inside the file because we moved everything else.
    // Let's find "Accordion: Suscripción y Planes" which is inside config, or similar, 
    // Wait, the best way to find where to put it is right before `export default AdminTab;` 
    // IF config is the last thing. Let's see where the `reports` can go.
    
    console.log('Start:', start);
    console.log('End:', end);
} else {
    console.log('Could not find start.');
}
