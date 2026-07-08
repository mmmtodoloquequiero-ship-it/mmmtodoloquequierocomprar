import re

with open('src/components/AdminTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Helper function to extract a block based on balanced braces
def extract_block(text, start_index):
    count = 0
    end_index = start_index
    started = False
    for i in range(start_index, len(text)):
        if text[i] == '{':
            count += 1
            started = True
        elif text[i] == '}':
            count -= 1
        if started and count == 0:
            end_index = i + 1
            break
    return text[start_index:end_index]

# 1. We will replace `view === 'employees'` with empty string because we will move it inside `config`.
employees_block_match = re.search(r"\{\s*view === 'employees' && \(\s*<AdminEmployeeTab tenant=\{tenant\} />\s*\)\s*\}", content)
if employees_block_match:
    content = content.replace(employees_block_match.group(0), "")

# 2. Extract `fiscal`
fiscal_match = re.search(r"\{\s*view === 'fiscal' && \(", content)
fiscal_block = ""
if fiscal_match:
    fiscal_block = extract_block(content, fiscal_match.start())
    content = content.replace(fiscal_block, "")

# 3. Extract `loyalty`
loyalty_match = re.search(r"\{\s*view === 'loyalty' && \(", content)
loyalty_block = ""
if loyalty_match:
    loyalty_block = extract_block(content, loyalty_match.start())
    content = content.replace(loyalty_block, "")

# 4. Extract `subscription`
subscription_match = re.search(r"\{\s*view === 'subscription' && tenant && \(", content)
subscription_block = ""
if subscription_match:
    subscription_block = extract_block(content, subscription_match.start())
    content = content.replace(subscription_block, "")

# Now we rewrite the `config` view block.
config_start_match = re.search(r"\{\s*view === 'config' && \(", content)
if not config_start_match:
    print("Config block not found!")
    exit(1)

config_entire_block = extract_block(content, config_start_match.start())

# Inside config_entire_block, we need to extract the sub-sections.
# We'll use regex to find the comments that separate them.

def extract_section(regex_start, regex_end_or_next):
    m_start = re.search(regex_start, config_entire_block, re.DOTALL)
    if not m_start: return ""
    m_next = re.search(regex_end_or_next, config_entire_block[m_start.start():], re.DOTALL)
    if m_next:
        return config_entire_block[m_start.start() : m_start.start() + m_next.start()]
    return config_entire_block[m_start.start():]

# Sections inside config:
s_color = extract_section(r"\{\/\*\s*1\.\s*Tema de Colores\s*\*\/\s*\}", r"\{\/\*\s*2\.\s*Roles de Acceso")
s_roles = extract_section(r"\{\/\*\s*2\.\s*Roles de Acceso", r"\{\/\*\s*3\.\s*Ajustes de Delivery Propios")
s_delivery_local = extract_section(r"\{\/\*\s*3\.\s*Ajustes de Delivery Propios", r"\{\/\*\s*3\.1\s*Zonas de Envío")
s_delivery_zones = extract_section(r"\{\/\*\s*3\.1\s*Zonas de Envío", r"\{\/\*\s*4\.\s*Configuración Mercado Pago")
s_mp = extract_section(r"\{\/\*\s*4\.\s*Configuración Mercado Pago", r"\{\/\*\s*5\.\s*Integración Delivery Apps")
s_delivery_apps = extract_section(r"\{\/\*\s*5\.\s*Integración Delivery Apps", r"\{\/\*\s*6\.\s*Perfil Público y Redes")
s_social = extract_section(r"\{\/\*\s*6\.\s*Perfil Público y Redes", r"\{\/\*\s*7\.\s*Módulo de Reservas")
s_reservas = extract_section(r"\{\/\*\s*7\.\s*Módulo de Reservas", r"\{\/\*\s*8\.\s*Landing Page")
s_landing = extract_section(r"\{\/\*\s*8\.\s*Landing Page", r"\{\/\*\s*Botón Guardar Config")
s_save_btn = extract_section(r"\{\/\*\s*Botón Guardar Config", r"\s*\)\s*\}\s*$")

# If any sections are combined, adjust.
# Wait, let's wrap each section in the Accordion structure.

def make_accordion(key, title, icon, active_cond, inner_content):
    return f"""
                        {{/* Accordion: {title} */}}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={{() => setExpandedConfigSection(prev => prev === '{key}' ? null : '{key}')}}
                                className={{`flex items-center justify-between p-4 rounded-2xl border transition-all ${{
                                    {active_cond} 
                                      ? (expandedConfigSection === '{key}' ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-slate-900/80 border-orange-500/50 text-orange-400')
                                      : (expandedConfigSection === '{key}' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }}`}}
                            >
                                <div className="flex items-center gap-3">
                                    <{icon} className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{{{active_cond} ? '✅ ' : ''}}{title}</span>
                                </div>
                                {{expandedConfigSection === '{key}' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}}
                            </button>
                            {{expandedConfigSection === '{key}' && (
                                <div className="glass p-6 rounded-2xl border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                                    {inner_content}
                                </div>
                            )}}
                        </div>
"""

# Strip out the outermost div in each extracted section to avoid double padding, or just keep them since they are already styled.
# Actually, the extracted sections contain the `div`s. We can just inject them.

# Clean up the blocks
fiscal_content = re.sub(r"^\{\s*view === 'fiscal' && \(\s*", "", fiscal_block)
fiscal_content = re.sub(r"\s*\)\s*\}$", "", fiscal_content)

loyalty_content = re.sub(r"^\{\s*view === 'loyalty' && \(\s*", "", loyalty_block)
loyalty_content = re.sub(r"\s*\)\s*\}$", "", loyalty_content)

subscription_content = re.sub(r"^\{\s*view === 'subscription' && tenant && \(\s*", "", subscription_block)
subscription_content = re.sub(r"\s*\)\s*\}$", "", subscription_content)


new_config_block = f"""{{view === 'config' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="px-2 mb-6">
                        <h3 className="font-black uppercase italic text-lg" style={{{{ color: tenant?.theme_colors?.primary || '#f97316' }}}}>Ajustes y Configuración</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Configura todos los aspectos de tu restaurante de forma centralizada</p>
                    </div>

                    <div className="grid gap-3">
                        {make_accordion('identidad', 'Identidad de Color', 'Paintbrush', 'true', s_color)}
                        {make_accordion('personal', 'Personal y Roles', 'Users', 'true', s_roles + '\\n<AdminEmployeeTab tenant={tenant} />')}
                        {make_accordion('envios', 'Módulo de Envíos Propios', 'Truck', 'cfgHasDelivery', s_delivery_local)}
                        {make_accordion('zonas', 'Zonas de Envío', 'Map', 'cfgHasDelivery', s_delivery_zones)}
                        {make_accordion('mp', 'Cobros por Mercado Pago', 'Wallet', '!!cfgMercadopagoAccessToken', s_mp)}
                        {make_accordion('apps', 'Integración Delivery Apps', 'Smartphone', 'cfgDeliveryAppsEnabled', s_delivery_apps)}
                        {make_accordion('social', 'Perfil y Redes Sociales', 'Share2', 'true', s_social)}
                        {make_accordion('reservas', 'Módulo de Reservas', 'Calendar', 'cfgReservationsEnabled', s_reservas)}
                        {make_accordion('landing', 'Landing Page', 'LayoutGrid', 'cfgLandingConfig.enabled', s_landing)}
                        {make_accordion('club', 'Club de Clientes', 'Trophy', 'loyConfigEnabled', loyalty_content)}
                        {make_accordion('fiscal', 'Facturación AFIP', 'Receipt', 'cfgAfipEnabled', fiscal_content)}
                        {make_accordion('suscripcion', 'Suscripción MyMapps', 'Award', 'true', subscription_content)}
                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-800">
                        {s_save_btn}
                    </div>
                </div>
            )}}"""

content = content.replace(config_entire_block, new_config_block)

# One small fix: the Users icon from lucide-react is needed.
if 'Users' not in content[:1000]:
    content = content.replace("import { Plus", "import { Users, Plus")

if 'Truck' not in content[:1000]:
    content = content.replace("import { Plus", "import { Truck, Plus")

if 'Map' not in content[:1000]:
    content = content.replace("import { Plus", "import { Map, Plus")

with open('src/components/AdminTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactor script executed.")
