const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const configStart = lines.findIndex(l => l.includes("{view === 'config' && ("));
const loyaltyStart = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
const subStart = lines.findIndex(l => l.includes("{view === 'subscription' && tenant && ("));

if (configStart !== -1 && loyaltyStart !== -1 && subStart !== -1) {
    const loyaltyInnerStart = loyaltyStart + 1;
    let loyaltyEnd = loyaltyStart + 1;
    let nesting = 0;
    while (loyaltyEnd < lines.length) {
        if (lines[loyaltyEnd].includes("{view ===") && loyaltyEnd > loyaltyStart + 5) break;
        if (lines[loyaltyEnd].includes("<div")) nesting += lines[loyaltyEnd].split("<div").length - 1;
        if (lines[loyaltyEnd].includes("</div")) nesting -= lines[loyaltyEnd].split("</div").length - 1;
        if (nesting === 0 && lines[loyaltyEnd].includes(")}")) break;
        loyaltyEnd++;
    }
    const loyaltyContentLines = lines.slice(loyaltyInnerStart, loyaltyEnd - 1);
    
    const subInnerStart = subStart + 1;
    let subEnd = subStart + 1;
    nesting = 0;
    while (subEnd < lines.length) {
        if (lines[subEnd].includes("{view ===") && subEnd > subStart + 5) break; 
        if (lines[subEnd].includes("<div")) nesting += lines[subEnd].split("<div").length - 1;
        if (lines[subEnd].includes("</div")) nesting -= lines[subEnd].split("</div").length - 1;
        if (nesting === 0 && lines[subEnd].includes(")}")) break;
        subEnd++;
    }
    const subContentLines = lines.slice(subInnerStart, subEnd - 1);

    const loyaltyAccordion = [
        "                        {/* Accordion: Club de Clientes (Fidelización) */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'loyalty' ? null : 'loyalty')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    tenant?.loyalty_enabled",
        "                                      ? (expandedConfigSection === 'loyalty' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400')",
        "                                      : (expandedConfigSection === 'loyalty' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')",
        "                                }`}",
        "                                style={{",
        "                                    borderColor: tenant?.loyalty_enabled ? (expandedConfigSection === 'loyalty' ? tenant?.theme_colors?.primary : undefined) : undefined,",
        "                                    color: tenant?.loyalty_enabled ? (expandedConfigSection === 'loyalty' ? tenant?.theme_colors?.primary : undefined) : undefined,",
        "                                }}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <Gift className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">{tenant?.loyalty_enabled ? '✅ ' : ''}Club de Clientes</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'loyalty' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>",
        "                            {expandedConfigSection === 'loyalty' && (",
        "                                <div className=\"glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2\">"
    ];
    
    const subAccordion = [
        "                        {/* Accordion: Suscripción y Planes */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'subscription' ? null : 'subscription')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'subscription' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                                style={{",
        "                                    borderColor: expandedConfigSection === 'subscription' ? tenant?.theme_colors?.primary : undefined,",
        "                                    color: expandedConfigSection === 'subscription' ? tenant?.theme_colors?.primary : undefined,",
        "                                }}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <Award className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Mi Suscripción</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'subscription' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>",
        "                            {expandedConfigSection === 'subscription' && (",
        "                                <div className=\"glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2\">"
    ];

    const accordionFooter = [
        "                                </div>",
        "                            )}",
        "                        </div>",
        ""
    ];

    // Splice from bottom to top so indices don't shift!
    lines.splice(subStart, subEnd - subStart + 1);
    lines.splice(loyaltyStart, loyaltyEnd - loyaltyStart + 1);

    // After deleting them, configEndIdx will be slightly different.
    // Actually, loyaltyStart and subStart are AFTER config. So deleting them does NOT affect lines before loyaltyStart!
    // So configEndIdx is still correct from the original array? 
    // Yes, but let's recalculate it just to be safe.
    let configEndIdx = loyaltyStart - 1; 
    while(configEndIdx > configStart && !lines[configEndIdx].includes(")}")) {
        configEndIdx--;
    }
    
    // configEndIdx is the `)}` of config.
    // The insertion point should be just before the closing </div> of space-y-4 which is 2 lines above `)}`.
    // Let's insert at `configEndIdx - 1` (just before `</div>` of space-y-6, meaning it's still inside config but maybe outside space-y-4).
    // Actually, it doesn't matter if it's inside space-y-4 or outside it as long as it's inside space-y-6. Both work nicely.
    const insertIdx = configEndIdx - 1;

    const combinedBlocks = [
        ...loyaltyAccordion,
        ...loyaltyContentLines,
        ...accordionFooter,
        ...subAccordion,
        ...subContentLines,
        ...accordionFooter
    ];

    lines.splice(insertIdx, 0, ...combinedBlocks);
    
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Successfully moved loyalty and subscription blocks to config view.');
} else {
    console.log('Could not find one of the blocks.');
}
