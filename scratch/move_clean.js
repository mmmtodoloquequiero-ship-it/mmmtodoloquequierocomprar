const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const configStart = lines.findIndex(l => l.includes("{view === 'config' && ("));
const loyaltyStart = lines.findIndex(l => l.includes("{view === 'loyalty' && ("));
const modalAjusteStart = lines.findIndex(l => l.includes("{/* MODAL DE AJUSTE MANUAL DE SALDO */}"));
const subStart = lines.findIndex(l => l.includes("{view === 'subscription' && tenant && ("));

if (configStart !== -1 && loyaltyStart !== -1 && subStart !== -1 && modalAjusteStart !== -1) {
    // Loyalty block
    // starts at loyaltyStart
    // ends at modalAjusteStart - 2 (which is the `)}` of the loyalty block)
    const loyaltyEnd = modalAjusteStart - 2;
    // Inner content excludes the first line (view === ...) and the last line ( )})
    const loyaltyContentLines = lines.slice(loyaltyStart + 1, loyaltyEnd);

    // Subscription block
    const subEnd = subStart + 2; // Since it's exactly 3 lines: view ===, <AdminSaasTab/>, )}
    const subContentLines = lines.slice(subStart + 1, subEnd);

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
        "                            {expandedConfigSection === 'loyalty' && ("
    ];
    // Notice I don't add `<div className="glass...">` here because loyaltyContentLines already has a `<div className="space-y-6...">` which is perfect as the container!

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
        "                            )}",
        "                        </div>",
        ""
    ];
    
    const subAccordionFooter = [
        "                                </div>",
        "                            )}",
        "                        </div>",
        ""
    ];

    // Splice backwards
    lines.splice(subStart, subEnd - subStart + 1);
    lines.splice(loyaltyStart, loyaltyEnd - loyaltyStart + 1);

    // Find insertion point at the end of config view
    let configEndIdx = loyaltyStart - 1; // Start searching from where loyalty was
    while(configEndIdx > configStart && !lines[configEndIdx].includes(")}")) {
        configEndIdx--;
    }
    
    // configEndIdx is the `)}` of config block.
    const insertIdx = configEndIdx - 1; // before the closing `</div>` of the config block

    const combinedBlocks = [
        ...loyaltyAccordion,
        ...loyaltyContentLines,
        ...accordionFooter,
        ...subAccordion,
        ...subContentLines,
        ...subAccordionFooter
    ];

    lines.splice(insertIdx, 0, ...combinedBlocks);
    
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Successfully moved loyalty and sub based on precise string bounds!');
} else {
    console.log('Could not find all markers.');
}
