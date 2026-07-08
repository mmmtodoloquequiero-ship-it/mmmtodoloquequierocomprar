const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Fix corruption at 2356
if (lines[2356] && lines[2356].includes('return (')) {
    lines.splice(2356, 1);
}

// 2. Fix corruption at 2384 (now 2383 since we removed a line)
if (lines[2383] && lines[2383].includes('); })()}')) {
    lines[2383] = lines[2383].replace('); })()}', ')}');
}

// 3. Fix the actual reports block!
const reportsCondIdx = lines.findIndex(l => l.includes("{expandedConfigSection === 'reports' && ("));
if (reportsCondIdx !== -1) {
    // Change to IIFE
    if (!lines[reportsCondIdx].includes("(() => {")) {
        lines[reportsCondIdx] = lines[reportsCondIdx].replace("{expandedConfigSection === 'reports' && (", "{expandedConfigSection === 'reports' && (() => {");
    }
    
    const reportsJSXStart = lines.findIndex((l, i) => i > reportsCondIdx && l.includes('<div className="space-y-6'));
    if (reportsJSXStart !== -1) {
        if (!lines[reportsJSXStart - 1].includes("return (")) {
            lines.splice(reportsJSXStart, 0, "                                return (");
        }
        
        const afipStart = lines.findIndex(l => l.includes('{/* Accordion: Facturación AFIP */}'));
        if (afipStart !== -1) {
            let reportsEnd = afipStart - 1;
            while(reportsEnd > reportsJSXStart && !lines[reportsEnd].includes(')}')) reportsEnd--;
            if (lines[reportsEnd].includes(')}')) {
                lines[reportsEnd] = lines[reportsEnd].replace(')}', '); })()}');
            }
        }
    }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Cleaned up corruption and fixed reports IIFE properly!');
