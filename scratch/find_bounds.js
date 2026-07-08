const fs = require('fs');
const lines = fs.readFileSync('c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx', 'utf8').split('\n');

const configStart = lines.findIndex(l => l.includes("{view === 'config' && ("));
const loyaltyStart = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
const subStart = lines.findIndex(l => l.includes("{view === 'subscription' && tenant && ("));

console.log('Config Start:', configStart);
console.log('Loyalty Start:', loyaltyStart);
console.log('Subscription Start:', subStart);

// Let's also find where config ends. It ends before loyaltyStart.
let configEnd = loyaltyStart - 1;
while(configEnd > configStart && !lines[configEnd].includes(")}")) {
    configEnd--;
}
console.log('Config End ()}):', configEnd);
