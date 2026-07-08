const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const tablesStart = lines.findIndex(l => l.includes('{/* Accordion: Gestión de Mesas y QR */}'));
const exportIdx = lines.findIndex(l => l.includes('export default AdminTab;'));

if (tablesStart !== -1 && exportIdx !== -1) {
    // Determine the end of the config block.
    // The config block ends right before the `loyalty` and `subscription` views if they exist.
    // Wait, the user said they are not there anymore! I reverted to cfe517c where loyalty and subscription are NOT in the file?
    // Let's find out where config ends by looking for `view === 'config' && (` and tracing the { }
    let configStart = lines.findIndex(l => l.includes("view === 'config' && ("));
    
    if (configStart !== -1) {
        let open = 0;
        let configEnd = -1;
        for (let i = configStart; i < lines.length; i++) {
            open += lines[i].split('{').length - 1;
            open -= lines[i].split('}').length - 1;
            if (open === 0 && i > configStart) {
                configEnd = i;
                break;
            }
        }
        console.log('tablesStart:', tablesStart);
        console.log('exportIdx:', exportIdx);
        console.log('configEnd:', configEnd);
        
        if (configEnd !== -1 && tablesStart > configEnd) {
            // Cut the tables/fiscal block
            const extracted = lines.splice(tablesStart, exportIdx - tablesStart);
            
            // Insert it before the final `</div>` of config
            // In typical React, it's `</div>\n)}` for the view block.
            // Let's insert it right at configEnd - 1 (which is usually the `</div>`)
            // Wait, if configEnd is the line with `}`, it might be `)}`.
            // We should insert it before the closing `</div>` of the config's main container.
            let insertIdx = configEnd;
            while(insertIdx > configStart && !lines[insertIdx].includes('</div>')) insertIdx--;
            
            lines.splice(insertIdx, 0, ...extracted);
            
            fs.writeFileSync(file, lines.join('\n'), 'utf8');
            console.log('Moved successfully to line ' + insertIdx);
        } else {
            console.log('Did not move. configEnd might be wrong or tables already inside.');
        }
    }
}
