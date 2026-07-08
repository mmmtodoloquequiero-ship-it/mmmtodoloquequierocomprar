const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
const fiscalStartIdx = lines.findIndex(l => l.includes("{view === 'fiscal' && ("));
const nextViewStartIdx = lines.findIndex((l, i) => i > fiscalStartIdx && l.includes("{view === "));
let endInner = nextViewStartIdx - 1;
while(endInner > fiscalStartIdx && !lines[endInner].includes(")}")) endInner--;
const content = lines.slice(fiscalStartIdx + 1, endInner).join('\n');
fs.writeFileSync('c:/Users/almir/juOliMyMapps/scratch/afip_block.tsx', "import React from 'react';\nexport const AFIP = () => { return (" + content + "); };", 'utf8');
