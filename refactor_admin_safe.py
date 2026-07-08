import re
import os

file_path = 'src/components/AdminTab.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def make_accordion(key, title, icon, active_cond):
    return f"""
                        {{/* Accordion: {title} */}}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={{() => setExpandedConfigSection(prev => prev === '{key}' ? null : '{key}')}}
                                className={{`flex items-center justify-between p-4 rounded-2xl border transition-all ${{
                                    {active_cond} 
                                      ? (expandedConfigSection === '{key}' ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-orange-500/30 text-orange-400')
                                      : (expandedConfigSection === '{key}' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }}`}}
                                style={{{{
                                    borderColor: {active_cond} ? (expandedConfigSection === '{key}' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: {active_cond} ? (expandedConfigSection === '{key}' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}}}
                            >
                                <div className="flex items-center gap-3">
                                    <{icon} className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{{{active_cond} ? '✅ ' : ''}}{title}</span>
                                </div>
                                {{expandedConfigSection === '{key}' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}}
                            </button>
                            {{expandedConfigSection === '{key}' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
"""

close_accordion = """
                                </div>
                            )}
                        </div>
"""

# Step 0: Add state and fix array
content = content.replace("const [expandedSection, setExpandedSection] = useState<{ month: string; type: 'income' | 'expense' | 'waste' } | null>(null);", 
"const [expandedSection, setExpandedSection] = useState<{ month: string; type: 'income' | 'expense' | 'waste' } | null>(null);\n    const [expandedConfigSection, setExpandedConfigSection] = useState<string | null>(null);")

content = content.replace(
"(['dashboard', 'stock', 'products', 'balance', 'sales', 'reports', 'tables', 'fiscal', 'loyalty', 'employees', 'config', 'subscription'] as const).map(v => {",
"(['dashboard', 'products', 'stock', 'sales', 'balance', 'config'] as const).map(v => {"
)

content = content.replace(
"setView(v);",
"setView(v as any);\n                                    if (v === 'config') setExpandedConfigSection(null);"
)

# Step 1: Wrap start of config block
config_start = """                    <div className="px-2">
                        <h3 className="font-black uppercase italic text-sm">Configuración de Marca y Roles</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Ajusta los colores y define los procesos activos de tu negocio</p>
                    </div>

                    <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5">
                        {/* 1. Tema de Colores */}"""

new_config_start = f"""                    <div className="px-2 mb-6">
                        <h3 className="font-black uppercase italic text-lg" style={{{{ color: tenant?.theme_colors?.primary || '#f97316' }}}}>Ajustes y Configuración</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Configura todos los aspectos de tu restaurante de forma centralizada</p>
                    </div>

                    <div className="space-y-4">
{make_accordion('identidad', 'Identidad de Color', 'Paintbrush', 'true')}
                        {{/* 1. Tema de Colores */}}"""

content = content.replace(config_start, new_config_start)

# Step 2: Insert Roles
envios_start = """                        {/* 2. Módulo de Envíos */}"""
new_envios_start = f"""{close_accordion}

{make_accordion('personal', 'Personal y Roles', 'Users', 'true')}
                                    <AdminEmployeeTab tenant={{tenant}} />
{close_accordion}

{make_accordion('envios', 'Módulo de Envíos Propios', 'Truck', 'cfgHasDelivery')}
                        {{/* 2. Módulo de Envíos */}}"""

content = content.replace(envios_start, new_envios_start)

# Step 3: Zonas de envio
zonas_start = """                        {/* 2.5 Configuración de Zonas de Envío */}"""
new_zonas_start = f"""{close_accordion}
{make_accordion('zonas', 'Zonas de Envío', 'Map', 'cfgHasDelivery')}
                        {{/* 2.5 Configuración de Zonas de Envío */}}"""
content = content.replace(zonas_start, new_zonas_start)

# Step 4: Mercado Pago
mp_start = """                        {/* 3. Mercado Pago */}"""
new_mp_start = f"""{close_accordion}
{make_accordion('mp', 'Cobros por Mercado Pago', 'Wallet', '!!cfgMercadopagoAccessToken')}
                        {{/* 3. Mercado Pago */}}"""
content = content.replace(mp_start, new_mp_start)

# Step 5: Redes sociales (And insert Delivery Apps before it)
social_start = """                        {/* 4. Perfil Público y Redes Sociales */}"""
new_social_start = f"""{close_accordion}

{make_accordion('apps', 'Integración Delivery Apps', 'Smartphone', 'cfgDeliveryAppsEnabled')}
                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">La integración con apps de delivery se configura desde Soporte.</p>
{close_accordion}

{make_accordion('social', 'Perfil y Redes Sociales', 'Share2', 'true')}
                        {{/* 4. Perfil Público y Redes Sociales */}}"""
content = content.replace(social_start, new_social_start)

# Step 6: End of config block (save button)
save_start = """                    <div className="pt-4 border-t border-white/5">
                        <button
                            type="button"
                            onClick={handleSaveConfig}"""

new_save_start = f"""{close_accordion}

{make_accordion('reservas', 'Módulo de Reservas', 'Calendar', 'cfgReservationsEnabled')}
                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">Módulo de reservas activo.</p>
{close_accordion}

{make_accordion('landing', 'Landing Page y Portal', 'LayoutGrid', 'cfgLandingConfig.enabled')}
                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">Configuración de la Landing Page en desarrollo...</p>
{close_accordion}
                    </div>
                    <div className="mt-8 pt-4 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={{handleSaveConfig}}"""

content = content.replace(save_start, new_save_start)

# Also fix the top nav active state for Ajustes (since 'config' is not explicitly handled in the ternary if it was cut)
content = content.replace("v === 'sales' ? (locked ? 'Ventas 🔒' : 'Ventas') :", "v === 'sales' ? (locked ? 'Ventas 🔒' : 'Ventas') : v === 'config' ? 'Ajustes' :")


# Import fixes
if 'Users' not in content[:1000]:
    content = content.replace("import { Plus", "import { Users, Plus")
if 'Truck' not in content[:1000]:
    content = content.replace("import { Plus", "import { Truck, Plus")
if 'Map' not in content[:1000]:
    content = content.replace("import { Plus", "import { Map, Plus")
if 'Smartphone' not in content[:1000]:
    content = content.replace("import { Plus", "import { Smartphone, Plus")
if 'Calendar' not in content[:1000]:
    content = content.replace("import { Plus", "import { Calendar, Plus")
if 'LayoutGrid' not in content[:1000]:
    content = content.replace("import { Plus", "import { LayoutGrid, Plus")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Safe python refactor done.")
