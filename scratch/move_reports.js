const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes("{view === 'reports' && (() => {"));
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
    // 1. Extract the block
    let extracted = lines.splice(start, end - start + 1);

    // 2. Remove the {view === 'reports' && (() => { wrapper and the trailing })()}
    // The first line is `            {view === 'reports' && (() => {`
    // The last line is `            })()}`
    extracted.shift();
    extracted.pop();

    // The content returns a JSX element, so it probably starts with `return (` and ends with `);`
    // Let's strip the `return (` and `);` to get raw JSX.
    const returnStartIdx = extracted.findIndex(l => l.includes("return ("));
    if (returnStartIdx !== -1) {
        extracted[returnStartIdx] = extracted[returnStartIdx].replace("return (", "");
        // remove the `);` at the end
        const returnEndIdx = extracted.findIndex((l, i) => i > returnStartIdx && l.includes(");"));
        if (returnEndIdx !== -1) {
            extracted[returnEndIdx] = extracted[returnEndIdx].replace(");", "");
        }
    }

    // 3. Wrap in accordion
    const accordionHeader = [
        "                        {/* Accordion: Centro de Reportes */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'reports' ? null : 'reports')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'reports' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <BarChart2 className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Centro de Reportes</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'reports' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>",
        "                            {expandedConfigSection === 'reports' && ("
    ];

    const accordionFooter = [
        "                            )}",
        "                        </div>"
    ];

    const finalBlock = [
        ...accordionHeader,
        ...extracted,
        ...accordionFooter
    ];

    // 4. Find where to insert it inside `config`
    // We can insert it before `Accordion: Facturación AFIP`
    const insertIdx = lines.findIndex(l => l.includes("{/* Accordion: Facturación AFIP */}"));

    if (insertIdx !== -1) {
        lines.splice(insertIdx, 0, ...finalBlock);
        
        // Add BarChart2 to imports
        const importLine = lines.findIndex(l => l.includes("import {") && l.includes("lucide-react"));
        if (importLine !== -1 && !lines[importLine].includes("BarChart2")) {
            lines[importLine] = lines[importLine].replace("import {", "import { BarChart2,");
        }

        fs.writeFileSync(file, lines.join('\n'), 'utf8');
        console.log("Successfully moved reports into config!");
    } else {
        console.log("Could not find Facturación AFIP to insert before.");
    }
} else {
    console.log("Could not extract reports.");
}
