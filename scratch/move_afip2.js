const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const fiscalStartIdx = lines.findIndex(l => l.includes("{view === 'fiscal' && ("));
const nextViewStartIdx = lines.findIndex((l, i) => i > fiscalStartIdx && l.includes("{view === "));

if (fiscalStartIdx !== -1 && nextViewStartIdx !== -1) {
    // Determine exact bounds
    const startInner = fiscalStartIdx + 2;
    let endInner = nextViewStartIdx - 1;
    while(endInner > startInner && !lines[endInner].includes(")}")) {
        endInner--;
    }
    // endInner is now the index of ')}'. The line before it is '</div>'.
    // So we want to extract up to endInner - 1 inclusive.
    // slice(start, end) excludes end, so end should be endInner.
    
    const fiscalContentLines = lines.slice(startInner, endInner);
    
    const accordionHeader = `                        {/* Accordion: Configuración Fiscal (AFIP) */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'afip' ? null : 'afip')}
                                className={\`flex items-center justify-between p-4 rounded-2xl border transition-all \${
                                    cfgAfipEnabled 
                                      ? (expandedConfigSection === 'afip' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400')
                                      : (expandedConfigSection === 'afip' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }\`}
                                style={{
                                    borderColor: cfgAfipEnabled ? (expandedConfigSection === 'afip' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: cfgAfipEnabled ? (expandedConfigSection === 'afip' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{cfgAfipEnabled ? '✅ ' : ''}Configuración Fiscal (AFIP)</span>
                                </div>
                                {expandedConfigSection === 'afip' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'afip' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">`;

    const accordionFooter = `                                </div>
                            )}
                        </div>`;

    // Delete the original fiscal block completely
    lines.splice(fiscalStartIdx, nextViewStartIdx - fiscalStartIdx);

    // Insert before MP accordion
    const mpStartIdx = lines.findIndex(l => l.includes("{/* Accordion: Cobros por Mercado Pago */}"));
    
    if (mpStartIdx !== -1) {
        const blockToInsert = [
            accordionHeader,
            ...fiscalContentLines,
            accordionFooter,
            ''
        ];
        lines.splice(mpStartIdx, 0, ...blockToInsert);
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log('File successfully updated.');
    } else {
        console.log('Insert index (mpStartIdx) not found.');
    }
} else {
    console.log('Fiscal block not found.');
}
