const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const tablesStart = lines.findIndex(l => l.includes('{/* Accordion: Gestión de Mesas y QR */}'));
const exportIdx = lines.findIndex(l => l.includes('export default AdminTab;'));

if (tablesStart !== -1 && exportIdx !== -1) {
    // Delete blank lines right before exportIdx until we reach the actual end of tables/fiscal
    let endContent = exportIdx - 1;
    while(lines[endContent].trim() === '') endContent--;
    
    // Actually, everything from tablesStart to exportIdx - 1 is the extracted content
    const extracted = lines.splice(tablesStart, exportIdx - tablesStart);
    
    // Now where do we put it?
    // We want it INSIDE config!
    // Config ends when `view === 'config' && (` closes!
    // But since config is huge, it's easier to find the end of the last accordion in config.
    // Let's find "Accordion: Landing Page y Portal" and then find its closing `</div>\n)}`
    
    let landingIdx = lines.findIndex(l => l.includes('{/* Accordion: Landing Page y Portal */}'));
    if (landingIdx === -1) landingIdx = lines.findIndex(l => l.includes('Landing Page y Portal'));
    
    if (landingIdx !== -1) {
        // Find the closing of this accordion
        let i = landingIdx;
        let nesting = 0;
        let foundOpen = false;
        while(i < lines.length) {
            if (lines[i].includes('<div')) { nesting += lines[i].split('<div').length - 1; foundOpen = true; }
            if (lines[i].includes('</div')) nesting -= lines[i].split('</div').length - 1;
            if (foundOpen && nesting === 0 && lines[i+1].includes(')}')) {
                // The closing of the accordion is at i+2 (which is the closing </div> of flex-col gap-2)
                lines.splice(i + 3, 0, ...extracted);
                fs.writeFileSync(file, lines.join('\n'), 'utf8');
                console.log('Moved inside config successfully.');
                break;
            }
            i++;
        }
    } else {
        console.log('Could not find Landing Page accordion.');
    }
} else {
    console.log('Could not find tablesStart or exportIdx');
}
