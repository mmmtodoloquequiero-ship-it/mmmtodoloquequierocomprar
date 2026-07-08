const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const enviosStart = lines.findIndex(l => l.includes("{/* Accordion: Módulo y zonas de envío */}"));
const enviosContentEnd = lines.findIndex(l => l.includes("{/* Accordion: Zonas de Envío */}")) - 1; // It's just before Zonas de Envío

const zonasStart = lines.findIndex(l => l.includes("{/* Accordion: Zonas de Envío */}"));
const zonasContentStart = lines.findIndex((l, i) => i > zonasStart && l.includes("{/* 2.5 Configuración de Zonas de Envío */}"));

// Find the end of Zonas de Envío block
let zonasEnd = zonasContentStart;
let nesting = 0;
while(zonasEnd < lines.length) {
    if (lines[zonasEnd].includes("<div")) nesting += lines[zonasEnd].split("<div").length - 1;
    if (lines[zonasEnd].includes("</div")) nesting -= lines[zonasEnd].split("</div").length - 1;
    if (nesting === 0 && lines[zonasEnd].includes(")}")) break;
    zonasEnd++;
}

if (enviosStart !== -1 && zonasStart !== -1 && zonasContentStart !== -1) {
    // Extract the exact content of Zonas de Envío
    // The content is from zonasContentStart to right before the closing `</div>` of the Zonas de Envío accordion.
    // Wait, let's just find the `)}` that closes Zonas de Envío
    let endOfZonasContent = zonasEnd - 1;
    while(!lines[endOfZonasContent].includes("</div>")) endOfZonasContent--; // The </div> that wraps the accordion content
    
    // Actually, `zonasContentStart` is inside the `<div className="glass...">` of Zonas de Envío.
    // So we extract from `zonasContentStart` to `endOfZonasContent - 1`.
    const zonasContentLines = lines.slice(zonasContentStart, endOfZonasContent);

    // Remove the entire Zonas de Envío Accordion from the file
    lines.splice(zonasStart, zonasEnd - zonasStart + 1);

    // Now append zonasContentLines to the end of Módulo de Envíos
    // To do this, find the `)}` of Módulo de Envíos. Since we deleted Zonas, it's just before where Zonas used to be!
    // Because Zonas de Envío was immediately after Módulo de Envíos!
    let enviosClosingIdx = zonasStart - 1;
    while(!lines[enviosClosingIdx].includes(")}")) enviosClosingIdx--;
    let enviosDivCloseIdx = enviosClosingIdx - 1;
    while(!lines[enviosDivCloseIdx].includes("</div>")) enviosDivCloseIdx--;

    // Insert at enviosDivCloseIdx
    lines.splice(enviosDivCloseIdx, 0, ...zonasContentLines);
    
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Successfully merged Zonas de Envío into Módulo y zonas de envío!');
} else {
    console.log('Could not find markers for merge.');
}
