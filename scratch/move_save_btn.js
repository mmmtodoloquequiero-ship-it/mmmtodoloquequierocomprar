const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const saveBtnStart = lines.findIndex(l => l.includes('{/* Save Button */}'));

if (saveBtnStart !== -1) {
    // Find the end of the save button block. It's an HTML button element.
    const saveBtnEnd = lines.findIndex((l, i) => i > saveBtnStart && l.includes('</button>'));
    
    if (saveBtnEnd !== -1) {
        // Extract the save button block
        const extractedBtn = lines.splice(saveBtnStart, saveBtnEnd - saveBtnStart + 1);
        
        // Find the very end of the config view.
        // It ends when `view === 'config' && (` closes.
        // We know we can find the end of config by looking for the closing tags of the config section.
        // The last inserted thing was `Suscripción y Planes`.
        const subStart = lines.findIndex(l => l.includes("{/* Accordion: Suscripción y Planes */}"));
        if (subStart !== -1) {
            // Find the closing </div> of Suscripción y Planes
            let subEnd = subStart;
            let subOpen = 0;
            let foundSubOpen = false;
            while(subEnd < lines.length) {
                subOpen += lines[subEnd].split('<div').length - 1;
                subOpen -= lines[subEnd].split('</div').length - 1;
                if (lines[subEnd].includes('<div')) foundSubOpen = true;
                if (foundSubOpen && subOpen === 0) {
                    break;
                }
                subEnd++;
            }
            
            // At subEnd, we have the closing </div> of the Suscripción accordion.
            // Insert the Guardar button right after that.
            lines.splice(subEnd + 1, 0, ...extractedBtn);
            
            fs.writeFileSync(file, lines.join('\n'), 'utf8');
            console.log('Successfully moved Save Button to the end of Ajustes!');
        } else {
            console.log('Could not find Suscripción y Planes');
        }
    } else {
        console.log('Could not find end of Save Button');
    }
} else {
    console.log('Could not find Save Button');
}
