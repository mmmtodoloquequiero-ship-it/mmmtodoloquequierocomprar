const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
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
    extracted[0] = extracted[0].replace("{view === 'loyalty' && (", "{expandedConfigSection === 'loyalty' && (");

    const accordionHeader = [
        "                        {/* Accordion: Club de Clientes */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'loyalty' ? null : 'loyalty')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'loyalty' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <Users className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Club de Clientes / Fidelización</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'loyalty' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
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
    // I will insert it immediately after `Accordion: Facturación AFIP`
    const afipStart = lines.findIndex(l => l.includes("{/* Accordion: Facturación AFIP */}"));
    if (afipStart !== -1) {
        // Find the end of Facturación AFIP
        let afipEnd = afipStart;
        let afipOpen = 0;
        let foundAfipOpen = false;
        while(afipEnd < lines.length) {
            afipOpen += lines[afipEnd].split('<div').length - 1;
            afipOpen -= lines[afipEnd].split('</div').length - 1;
            if (lines[afipEnd].includes('<div')) foundAfipOpen = true;
            if (foundAfipOpen && afipOpen === 0) {
                break;
            }
            afipEnd++;
        }
        
        // Insert right after the closing </div> of Facturación AFIP
        lines.splice(afipEnd + 1, 0, ...finalBlock);

        // Make sure `Users` is imported from lucide-react
        const importLine = lines.findIndex(l => l.includes("import {") && l.includes("lucide-react"));
        if (importLine !== -1 && !lines[importLine].includes("Users,")) {
            lines[importLine] = lines[importLine].replace("import {", "import { Users,");
        }

        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log("Successfully moved loyalty into config!");
    } else {
        console.log("Could not find Facturación AFIP.");
    }
} else {
    console.log("Could not extract loyalty block.");
}
