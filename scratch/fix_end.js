const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const tablesStart = lines.findIndex(l => l.includes('{/* Accordion: Gestión de Mesas y QR */}'));
if (tablesStart !== -1) {
    // extract everything from tablesStart to the very end
    const extracted = lines.splice(tablesStart, lines.length - tablesStart);
    
    // Now find the end of config
    let configStart = lines.findIndex(l => l.includes("view === 'config' && ("));
    let configEnd = -1;
    if (configStart !== -1) {
        let open = 0;
        for (let i = configStart; i < lines.length; i++) {
            open += lines[i].split('{').length - 1;
            open -= lines[i].split('}').length - 1;
            if (open === 0 && i > configStart) {
                configEnd = i;
                break;
            }
        }
        
        if (configEnd !== -1) {
            let insertIdx = configEnd;
            while(insertIdx > configStart && !lines[insertIdx].includes('</div>')) insertIdx--;
            
            // Insert extracted here
            lines.splice(insertIdx, 0, ...extracted);
            
            // Wait, we need to make sure the file still ends with `export default AdminTab;`
            // `export default AdminTab;` should still be around!
            // Wait, my `extracted` block does NOT contain `export default AdminTab;` because `export default AdminTab;` was BEFORE `tablesStart`!
            // Yes! `export default AdminTab;` is at line 6688, and `tablesStart` was 6690!
            
            fs.writeFileSync(file, lines.join('\n'), 'utf8');
            console.log('Successfully fixed and moved to config!');
        }
    }
}
