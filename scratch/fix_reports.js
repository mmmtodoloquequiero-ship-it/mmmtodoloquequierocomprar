const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const errorLine = lines.findIndex(l => l.includes("const { start, end } = getFilteredDateRange();"));

if (errorLine !== -1) {
    const condLine = errorLine - 1;
    if (lines[condLine].includes("{expandedConfigSection === 'reports' && (")) {
        lines[condLine] = lines[condLine].replace("{expandedConfigSection === 'reports' && (", "{expandedConfigSection === 'reports' && (() => {");
    }
    
    // Find where the JSX starts
    const firstDiv = lines.findIndex((l, i) => i > errorLine && l.includes("<div "));
    if (firstDiv !== -1) {
        lines.splice(firstDiv, 0, "                                return (");
    }
    
    // Find the end of the accordion
    const endAccordion = lines.findIndex((l, i) => i > firstDiv && l.includes(")}"));
    if (endAccordion !== -1) {
        lines[endAccordion] = lines[endAccordion].replace(")}", "); })()}");
    }
    
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Fixed the IIFE for reports');
} else {
    console.log('Could not find error line');
}
