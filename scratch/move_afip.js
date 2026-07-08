const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const fiscalStartIdx = lines.findIndex(l => l.includes("{view === 'fiscal' && ("));
const nextViewStartIdx = lines.findIndex((l, i) => i > fiscalStartIdx && l.includes("{view === "));

if (fiscalStartIdx !== -1 && nextViewStartIdx !== -1) {
    // Inner content skips the <div> wrapper just like we did with tables.
    // fiscalStartIdx is `{view === 'fiscal' && (`
    // fiscalStartIdx + 1 is `<div className="space-y-6 animate-in slide-in-from-bottom-4">`
    // nextViewStartIdx - 2 is `            )}`
    // nextViewStartIdx - 3 is `                </div>`
    
    // We want the lines from fiscalStartIdx + 2 to nextViewStartIdx - 4 (inclusive)
    const fiscalInnerStartIdx = fiscalStartIdx + 2;
    const fiscalInnerEndIdx = nextViewStartIdx - 3;
    
    const fiscalContentLines = lines.slice(fiscalInnerStartIdx, fiscalInnerEndIdx);
    
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

    // Remove the fiscal block
    lines.splice(fiscalStartIdx, nextViewStartIdx - fiscalStartIdx);

    // Insert into config section. After "Cobros por Mercado Pago" accordion.
    const mpAccordionStartIdx = lines.findIndex(l => l.includes("{/* Accordion: Cobros por Mercado Pago */}"));
    
    // Find the end of the MP accordion: the closing </div> of the accordion
    let mpAccordionEndIdx = mpAccordionStartIdx;
    let nesting = 0;
    for (let i = mpAccordionStartIdx + 1; i < lines.length; i++) {
        if (lines[i].includes('<div')) nesting++;
        if (lines[i].includes('</div')) nesting--;
        if (nesting < 0) {
            mpAccordionEndIdx = i;
            break;
        }
    }
    
    // Insert after MP accordion
    const insertIdx = mpAccordionEndIdx + 1;

    if (mpAccordionStartIdx !== -1 && insertIdx !== -1) {
        const blockToInsert = [
            accordionHeader,
            ...fiscalContentLines,
            accordionFooter,
            ''
        ];
        lines.splice(insertIdx, 0, ...blockToInsert);
        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log('File successfully updated.');
    } else {
        console.log('Insert index not found.');
    }
} else {
    console.log('Fiscal block not found.');
}
