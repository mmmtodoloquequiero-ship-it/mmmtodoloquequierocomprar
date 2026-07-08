const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes("{view === 'subscription' && tenant && ("));
let end = -1;
if (start !== -1) {
    let open = 0;
    for (let i = start; i < lines.length; i++) {
        open += lines[i].split('{').length - 1;
        open -= lines[i].split('}').length - 1;
        if (open === 0 && i > start) {
            end = i;
            break;
        }
    }
}

if (start !== -1 && end !== -1) {
    // Extract the block
    let extracted = lines.splice(start, end - start + 1);

    // Replace the condition
    extracted[0] = extracted[0].replace("{view === 'subscription' && tenant && (", "{expandedConfigSection === 'subscription' && tenant && (");

    const accordionHeader = [
        "                        {/* Accordion: Suscripción y Planes */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'subscription' ? null : 'subscription')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'subscription' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <CreditCard className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Suscripción y Planes</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'subscription' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>"
    ];

    const accordionFooter = [
        "                        </div>"
    ];

    const finalBlock = [
        ...accordionHeader,
        ...extracted,
        ...accordionFooter
    ];

    // Find where to insert it inside `config`
    // I will insert it immediately after `Accordion: Club de Clientes`
    const loyaltyStart = lines.findIndex(l => l.includes("{/* Accordion: Club de Clientes */}"));
    if (loyaltyStart !== -1) {
        // Find the end of Club de Clientes
        let loyaltyEnd = loyaltyStart;
        let loyaltyOpen = 0;
        let foundLoyaltyOpen = false;
        while(loyaltyEnd < lines.length) {
            loyaltyOpen += lines[loyaltyEnd].split('<div').length - 1;
            loyaltyOpen -= lines[loyaltyEnd].split('</div').length - 1;
            if (lines[loyaltyEnd].includes('<div')) foundLoyaltyOpen = true;
            if (foundLoyaltyOpen && loyaltyOpen === 0) {
                break;
            }
            loyaltyEnd++;
        }
        
        // Insert right after the closing </div> of Club de Clientes
        lines.splice(loyaltyEnd + 1, 0, ...finalBlock);

        // Make sure `CreditCard` is imported from lucide-react
        const importLine = lines.findIndex(l => l.includes("import {") && l.includes("lucide-react"));
        if (importLine !== -1 && !lines[importLine].includes("CreditCard,")) {
            lines[importLine] = lines[importLine].replace("import {", "import { CreditCard,");
        }

        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log("Successfully moved subscription into config!");
    } else {
        console.log("Could not find Club de Clientes.");
    }
} else {
    console.log("Could not extract subscription block.");
}
