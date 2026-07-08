const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const tablesStart = lines.findIndex(l => l.includes("{view === 'tables' && ("));
const fiscalStart = lines.findIndex(l => l.includes("{view === 'fiscal' && ("));
const reportsStart = lines.findIndex(l => l.includes("{view === 'reports' && (() => {"));
const configStart = lines.findIndex(l => l.includes("{view === 'config' && ("));

if (tablesStart !== -1 && fiscalStart !== -1 && reportsStart !== -1 && configStart !== -1) {
    
    // Find the end of tables
    let tablesEnd = fiscalStart - 1;
    while(tablesEnd > tablesStart && !lines[tablesEnd].includes(")}")) tablesEnd--;

    // Find the end of fiscal
    let fiscalEnd = reportsStart - 1;
    while(fiscalEnd > fiscalStart && !lines[fiscalEnd].includes(")}")) fiscalEnd--;

    // Extract blocks
    const tablesLines = lines.slice(tablesStart + 1, tablesEnd);
    const fiscalLines = lines.slice(fiscalStart + 1, fiscalEnd);

    const tablesAccordion = [
        "                        {/* Accordion: Gestión de Mesas y QR */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'tables' ? null : 'tables')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'tables' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <QrCode className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Gestión de Mesas y Códigos QR</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'tables' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>",
        "                            {expandedConfigSection === 'tables' && ("
    ];

    const fiscalAccordion = [
        "                        {/* Accordion: Facturación AFIP */}",
        "                        <div className=\"flex flex-col gap-2\">",
        "                            <button",
        "                                onClick={() => setExpandedConfigSection(prev => prev === 'fiscal' ? null : 'fiscal')}",
        "                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${",
        "                                    expandedConfigSection === 'fiscal' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400'",
        "                                }`}",
        "                            >",
        "                                <div className=\"flex items-center gap-3\">",
        "                                    <FileText className=\"w-5 h-5\" />",
        "                                    <span className=\"font-bold uppercase text-sm tracking-wider\">Facturación Fiscal (AFIP)</span>",
        "                                </div>",
        "                                {expandedConfigSection === 'fiscal' ? <ChevronUp className=\"w-5 h-5\" /> : <ChevronDown className=\"w-5 h-5\" />}",
        "                            </button>",
        "                            {expandedConfigSection === 'fiscal' && ("
    ];

    const accFooter = [
        "                            )}",
        "                        </div>",
        ""
    ];

    // Splice backwards
    lines.splice(fiscalStart, fiscalEnd - fiscalStart + 1);
    lines.splice(tablesStart, tablesEnd - tablesStart + 1);

    // Merge Módulo de Envíos and Zonas de Envío
    // We can just rename "Módulo de Envíos Propios" and delete the Zonas de Envío accordion wrapper
    const enviosBtnLine = lines.findIndex(l => l.includes("Módulo de Envíos Propios"));
    if (enviosBtnLine !== -1) {
        lines[enviosBtnLine] = lines[enviosBtnLine].replace("Módulo de Envíos Propios", "Módulo y zonas de envío");
    }

    const zonasHeaderLine = lines.findIndex(l => l.includes("Zonas de Envío") && l.includes("Accordion:"));
    if (zonasHeaderLine !== -1) {
        // we find the start of the `Zonas de Envío` accordion block.
        // It starts with `{/* Accordion: Zonas de Envío */}`
        // Then `<div className="flex flex-col gap-2">`
        // Then `<button...`
        // We can just remove the button wrapper and the corresponding `)}` closing.
        // Wait, the Zonas de Envío depends on `expandedConfigSection === 'delivery_zones'`.
        // If we merge them, we can just put the Zonas de Envío content inside the `expandedConfigSection === 'delivery'`!
        // This requires rewriting the zones block. For now, since user just said "que aparezca el módulo de envíos propios y zonas de envío, en un solo item. Módulo y zonas de envío", renaming the first one and moving the zones inside might be slightly complex. Let's just do it manually next step if needed, or do it here.
    }

    // Insert fiscal and tables right before `loyalty` inside `config`!
    const updatedLoyaltyStart = lines.findIndex(l => l.includes("{/* Accordion: Club de Clientes (Fidelización) */}"));
    
    // Insert just before loyalty!
    const combinedBlocks = [
        ...tablesAccordion,
        ...tablesLines,
        ...accFooter,
        ...fiscalAccordion,
        ...fiscalLines,
        ...accFooter
    ];

    lines.splice(updatedLoyaltyStart, 0, ...combinedBlocks);

    // We also need to add FileText and QrCode to lucide-react imports if not there.
    const importLine = lines.findIndex(l => l.includes("import {") && l.includes("lucide-react"));
    if (importLine !== -1) {
        if (!lines[importLine].includes("FileText")) lines[importLine] = lines[importLine].replace("import {", "import { FileText,");
        if (!lines[importLine].includes("QrCode")) lines[importLine] = lines[importLine].replace("import {", "import { QrCode,");
    }

    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Successfully restored AFIP and Mesas to config!');
} else {
    console.log('Could not find all markers.');
}
