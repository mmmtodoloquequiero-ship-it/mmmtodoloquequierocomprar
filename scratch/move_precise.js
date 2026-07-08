const fs = require('fs');
const file = 'c:/Users/almir/juOliMyMapps/src/components/AdminTab.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const l = 6505;
const lEnd = 7010;
const s = 7014;
const sEnd = 7057;

// Inner content exactly between wrapper and closing )}, inclusive of wrapper <div>
const loyaltyContentLines = lines.slice(l + 1, lEnd); 
const subContentLines = lines.slice(s + 1, sEnd);

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

// Splice backwards
lines.splice(s, sEnd - s + 1);
lines.splice(l, lEnd - l + 1);

// Find insertion index for config view.
// It should be at the end of config view.
const configStartIdx = lines.findIndex(line => line.includes("{view === 'config' && ("));
let configEndIdx = l - 1; // Since we deleted l, l is now the line AFTER configEndIdx in the new array?
// Wait, l was 6505. If we deleted from 6505, the line at 6504 is now lines[6504].
// Let's just find `)}` upwards from `l`.
while(configEndIdx > configStartIdx && !lines[configEndIdx].includes(")}")) {
    configEndIdx--;
}

// configEndIdx is `)}` of config.
// The line before `)}` is `</div>` (closes space-y-6).
// The line before that is `</div>` (closes space-y-4 which holds accordions).
// We should insert just before `</div>` that closes space-y-4, which is configEndIdx - 1.
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
console.log('Successfully moved blocks with precise line numbers!');
