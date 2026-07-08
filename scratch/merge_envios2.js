const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const enviosStartIdx = lines.findIndex(l => l.includes("{/* Accordion: Módulo de Envíos Propios */}"));
const zonasStartIdx = lines.findIndex(l => l.includes("{/* Accordion: Zonas de Envío */}"));
const mpStartIdx = lines.findIndex(l => l.includes("{/* Accordion: Cobros por Mercado Pago */}"));

if (enviosStartIdx !== -1 && zonasStartIdx !== -1 && mpStartIdx !== -1) {
    const zonasInnerStartIdx = lines.findIndex((l, i) => i > zonasStartIdx && l.includes("{/* 2.5 Configuración de Zonas de Envío */}"));
    
    // The correct end of the Zonas block is the `)}` before the glass panel's `</div>`.
    // It's easier to find it by going backwards from `mpStartIdx`.
    let zonasInnerEndIdx = mpStartIdx - 1;
    while(zonasInnerEndIdx > zonasInnerStartIdx && !lines[zonasInnerEndIdx].includes(")}")) {
        zonasInnerEndIdx--;
    }
    // Now `zonasInnerEndIdx` points to `)}` which belongs to `expandedConfigSection === 'zonas' && (`
    // The inner content's `)}` (which closes `cfgHasDelivery && (`) is earlier.
    // Wait, the glass panel closes with `</div> \n )}`
    // Let's find the `)}` that closes `cfgHasDelivery && (`
    // It's the one right before the glass panel closes.
    // So if we go backwards from mpStartIdx, we skip the `</div>` of the flex col, the `)}` of the accordion, the `</div>` of the glass panel, and then we hit the `)}` of the cfgHasDelivery.
    let countParenthesesClose = 0;
    let targetIdx = mpStartIdx;
    while(targetIdx > zonasInnerStartIdx) {
        if (lines[targetIdx].includes(")}")) countParenthesesClose++;
        if (countParenthesesClose === 2) {
            // This is the `)}` that closes `cfgHasDelivery && (`
            break;
        }
        targetIdx--;
    }
    
    const zonasContentLines = lines.slice(zonasInnerStartIdx, targetIdx + 1); // includes the `)}`
    
    // Find the insertion point in Envios. We want to insert right before the `</div>` of its glass panel.
    // Which means before the FIRST `</div>` and `)}` starting backwards from `zonasStartIdx`.
    let insertIdx = zonasStartIdx - 1;
    while (insertIdx > enviosStartIdx && !lines[insertIdx].includes("</div>")) {
        insertIdx--;
    }
    // insertIdx is now the `</div>` of the glass panel of Envios.
    // We insert BEFORE it.
    
    if (zonasInnerStartIdx !== -1 && targetIdx !== -1 && insertIdx !== -1) {
        lines.splice(zonasStartIdx, mpStartIdx - zonasStartIdx);
        lines.splice(insertIdx, 0, ...zonasContentLines);
        
        for (let i = enviosStartIdx; i < enviosStartIdx + 30; i++) {
            if (lines[i].includes("Módulo de Envíos Propios")) {
                lines[i] = lines[i].replace("Módulo de Envíos Propios", "Módulo y zonas de envío");
            }
        }
        
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log('Successfully merged Envios and Zonas.');
    } else {
        console.log('Failed to find exact indices for merge.');
    }
}
