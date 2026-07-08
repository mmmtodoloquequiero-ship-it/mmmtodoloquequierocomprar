const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
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
    console.log('Loyalty starts at:', start);
    console.log('Loyalty ends at:', end);
} else {
    console.log('Loyalty not found');
}
