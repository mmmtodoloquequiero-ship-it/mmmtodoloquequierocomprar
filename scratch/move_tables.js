const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startTableIdx = lines.findIndex(l => l.includes("{view === 'tables' && ("));
const endTableIdx = lines.findIndex((l, i) => i > startTableIdx && l.includes("            )}") && lines[i-1].includes("                </div>") && lines[i-2].includes("                    })()}"));

console.log('Start tables:', startTableIdx);
console.log('End tables:', endTableIdx);

if (startTableIdx !== -1 && endTableIdx !== -1) {
    const tableContentLines = lines.slice(startTableIdx + 2, endTableIdx - 1); // Exclude the wrapper div
    
    const accordionHeader = `                        {/* Accordion: Gestión de Mesas y Códigos QR */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'mesas' ? null : 'mesas')}
                                className={\`flex items-center justify-between p-4 rounded-2xl border transition-all \${
                                    true 
                                      ? (expandedConfigSection === 'mesas' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400')
                                      : (expandedConfigSection === 'mesas' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }\`}
                                style={{
                                    borderColor: true ? (expandedConfigSection === 'mesas' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: true ? (expandedConfigSection === 'mesas' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <LayoutGrid className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">🪑 Gestión de Mesas y QRs</span>
                                </div>
                                {expandedConfigSection === 'mesas' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'mesas' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">`;

    const accordionFooter = `                                </div>
                            )}
                        </div>`;

    lines.splice(startTableIdx, endTableIdx - startTableIdx + 1);

    const configIdx = lines.findIndex(l => l.includes("{view === 'config' && ("));
    const insertIdx = lines.findIndex((l, i) => i > configIdx && l.includes("{/* Accordion: Identidad de Color */}"));
    
    console.log('Config idx:', configIdx);
    console.log('Insert idx:', insertIdx);

    if (insertIdx !== -1) {
        const blockToInsert = [
            accordionHeader,
            ...tableContentLines,
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
    console.log('Table block not found.');
}
