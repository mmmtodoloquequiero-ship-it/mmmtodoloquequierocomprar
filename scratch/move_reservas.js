const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const resBlockStart = lines.findIndex(l => l.includes('{/* Reservas y Códigos de Descuento (UI) */}'));

let resBlockEnd = -1;
if (resBlockStart !== -1) {
    // Find the opening brace of {cfgReservationsEnabled && (
    const condStart = lines.findIndex((l, i) => i > resBlockStart && l.includes('{cfgReservationsEnabled && ('));
    if (condStart !== -1) {
        let open = 0;
        for (let i = condStart; i < lines.length; i++) {
            open += lines[i].split('{').length - 1;
            open -= lines[i].split('}').length - 1;
            if (open === 0 && i > condStart) {
                resBlockEnd = i;
                break;
            }
        }
    }
}

if (resBlockStart !== -1 && resBlockEnd !== -1) {
    // Extract it
    const extracted = lines.splice(resBlockStart, resBlockEnd - resBlockStart + 1);
    
    // Now replace the placeholder inside "Módulo de Reservas"
    // The placeholder is inside `expandedConfigSection === 'reservas' && (`
    const modStart = lines.findIndex(l => l.includes('{/* Accordion: Módulo de Reservas */}'));
    if (modStart !== -1) {
        const condStart = lines.findIndex((l, i) => i > modStart && l.includes("expandedConfigSection === 'reservas' && ("));
        if (condStart !== -1) {
            // Find the placeholder div
            const divStart = lines.findIndex((l, i) => i > condStart && l.includes('<div className="glass'));
            if (divStart !== -1) {
                // Remove the <p>Módulo de reservas activo.</p> line
                const pLine = lines.findIndex((l, i) => i > divStart && l.includes('<p className="text-[10px] text-slate-500 font-bold uppercase italic">Módulo de reservas activo.</p>'));
                if (pLine !== -1) {
                    lines.splice(pLine, 1);
                    
                    // Insert the extracted block exactly here
                    lines.splice(pLine, 0, ...extracted);
                    
                    fs.writeFileSync(file, lines.join('\n'), 'utf8');
                    console.log('Successfully moved Reservas out of Social into Reservas accordion!');
                } else {
                    console.log('Could not find placeholder <p> tag inside Reservas.');
                }
            } else {
                console.log('Could not find <div class="glass" inside Reservas accordion.');
            }
        } else {
            console.log('Could not find expandedConfigSection === "reservas" cond');
        }
    } else {
        console.log('Could not find Accordion: Módulo de Reservas');
    }
} else {
    console.log('Could not find or measure Reservas y Códigos de Descuento (UI) block');
}
