const fs = require('fs');
const lines = fs.readFileSync('c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx', 'utf8').split('\n');

const l = 6505;
const lEnd = 7010;
const s = 7014;
const sEnd = 7057;

const loyaltyContentLines = lines.slice(l + 1, lEnd); 
const subContentLines = lines.slice(s + 1, sEnd);

fs.writeFileSync('c:/Users/almir/juOliMyMapps/scratch/loyalty.tsx', "import React from 'react';\nexport const Loyalty = () => { return (\n" + loyaltyContentLines.join('\n') + "\n); };", 'utf8');
fs.writeFileSync('c:/Users/almir/juOliMyMapps/scratch/sub.tsx', "import React from 'react';\nexport const Sub = () => { return (\n" + subContentLines.join('\n') + "\n); };", 'utf8');
