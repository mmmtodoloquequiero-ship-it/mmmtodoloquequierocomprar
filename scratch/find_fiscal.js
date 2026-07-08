const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const fiscalStart = lines.findIndex(l => l.includes("{view === 'fiscal' && ("));
const nextViewStart = lines.findIndex((l, i) => i > fiscalStart && l.includes("{view === "));
console.log('Fiscal Start:', fiscalStart);
console.log('Next View Start:', nextViewStart);
console.log('Total Lines in Fiscal Block:', nextViewStart - fiscalStart);
