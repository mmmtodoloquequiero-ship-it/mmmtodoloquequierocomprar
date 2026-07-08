import os

file_path = 'src/components/AdminTab.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_config = False
config_brackets = 0

def make_accordion(key, title, icon, active_cond):
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
"""

def close_accordion():
    return """
                                </div>
                            )}
                        </div>
"""

i = 0
while i < len(lines):
    line = lines[i]
    
    if "view === 'config' && (" in line:
        in_config = True
        config_brackets = 0

    if in_config:
        if "{" in line: config_brackets += line.count("{")
        if "}" in line: config_brackets -= line.count("}")
        
        # Replace start of config
        if '<div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5">' in line:
            new_lines.append('                    <div className="grid gap-3">\n')
            i += 1
            continue

        # 1. Tema de Colores
        if "{/* 1. Tema de Colores */}" in line:
            new_lines.append(make_accordion('identidad', 'Identidad de Color', 'Paintbrush', 'true'))
            new_lines.append(line)
            i += 1
            continue
            
        # Insert Roles here
        if "{/* 2. Módulo de Envíos */}" in line:
            # Close previous
            new_lines.append(close_accordion())
            
            # Insert Personal
            new_lines.append(make_accordion('personal', 'Personal y Roles', 'Users', 'true'))
            new_lines.append('                                    <AdminEmployeeTab tenant={tenant} />\n')
            new_lines.append(close_accordion())
            
            # Start Envios
            new_lines.append(make_accordion('envios', 'Módulo de Envíos Propios', 'Truck', 'cfgHasDelivery'))
            new_lines.append(line)
            i += 1
            continue

        if "{/* 2.5 Configuración de Zonas de Envío */}" in line:
            new_lines.append(close_accordion())
            new_lines.append(make_accordion('zonas', 'Zonas de Envío', 'Map', 'cfgHasDelivery'))
            new_lines.append(line)
            i += 1
            continue

        if "{/* 3. Mercado Pago */}" in line:
            new_lines.append(close_accordion())
            new_lines.append(make_accordion('mp', 'Cobros por Mercado Pago', 'Wallet', '!!cfgMercadopagoAccessToken'))
            new_lines.append(line)
            i += 1
            continue

        if "{/* 4. Perfil Público y Redes Sociales */}" in line:
            new_lines.append(close_accordion())
            # Insert Delivery Apps
            new_lines.append(make_accordion('apps', 'Integración Delivery Apps', 'Smartphone', 'cfgDeliveryAppsEnabled'))
            new_lines.append('                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">La integración con apps de delivery se configura desde Soporte.</p>\n')
            new_lines.append(close_accordion())
            
            new_lines.append(make_accordion('social', 'Perfil y Redes Sociales', 'Share2', 'true'))
            new_lines.append(line)
            i += 1
            continue

        # Check for the end of config block button
        if '<button' in line and 'Guardar Cambios' in "".join(lines[i:i+10]):
            # This is the save button. We need to close the last accordion and append the rest.
            new_lines.append(close_accordion())
            
            # Insert Reservas
            new_lines.append(make_accordion('reservas', 'Módulo de Reservas', 'Calendar', 'cfgReservationsEnabled'))
            new_lines.append('                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">Módulo de reservas activo.</p>\n')
            new_lines.append(close_accordion())
            
            # Insert Landing
            new_lines.append(make_accordion('landing', 'Landing Page y Portal', 'LayoutGrid', 'cfgLandingConfig.enabled'))
            new_lines.append('                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">Configuración de la Landing Page en desarrollo...</p>\n')
            new_lines.append(close_accordion())

            # Now add the button logic as it was
            new_lines.append('                    <div className="mt-8 pt-4 border-t border-slate-800">\n')
            new_lines.append(line)
            i += 1
            in_config = False
            continue

    new_lines.append(line)
    i += 1

# Also we need to remove employees view block entirely.
final_lines = []
skip = False
for line in new_lines:
    if "view === 'employees' && (" in line:
        skip = True
    if skip and "}" in line and "view ===" not in line and "AdminEmployeeTab" not in line and "<div" not in line:
        # crude but effective
        if ")}" in line:
            skip = False
            continue
    if not skip:
        final_lines.append(line)

# Let's fix imports
content = "".join(final_lines)
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

print("Python refactor done.")
