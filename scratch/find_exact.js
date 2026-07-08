const fs = require('fs');
const lines = fs.readFileSync('c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx', 'utf8').split('\n');

const l = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
const s = lines.findIndex(l => l.includes("{view === 'subscription' && tenant && ("));

let lEnd = s - 1;
while(lEnd > l && !lines[lEnd].includes(')}')) lEnd--;

let sEnd = lines.length - 1;
while(sEnd > s && !lines[sEnd].includes(')}')) sEnd--;

console.log('loyalty start:', l);
console.log('loyalty end:', lEnd);
console.log('sub start:', s);
console.log('sub end:', sEnd);
