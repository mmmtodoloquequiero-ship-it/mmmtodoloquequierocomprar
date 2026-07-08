import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, ActiveDevice, UserRole } from '@/types/database';
import { Shield, Plus, Trash2, Smartphone, Eye, EyeOff, Loader2, RefreshCw, XCircle, AlertTriangle, Save, Settings2 } from 'lucide-react';

interface AdminEmployeeTabProps {
    tenant: any;
}

const ROLES: { id: UserRole, label: string }[] = [
    { id: 'admin', label: 'Administrador' },
    { id: 'staff', label: 'Cajero/Staff' },
    { id: 'delivery', label: 'Repartidor' },
];

export const AdminEmployeeTab: React.FC<AdminEmployeeTabProps> = ({ tenant }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [activeDevices, setActiveDevices] = useState<ActiveDevice[]>([]);
    const [loading, setLoading] = useState(true);

    const [empName, setEmpName] = useState('');
    const [empRole, setEmpRole] = useState<UserRole>('staff');
    const [empPin, setEmpPin] = useState('');
    const [showPinId, setShowPinId] = useState<string | null>(null);

    const maxDevices = tenant?.max_devices || 3;
    
    // Estados para configuración de límites
    const [planMaxDevices, setPlanMaxDevices] = useState<number>(9999);
    const [desiredMaxDevices, setDesiredMaxDevices] = useState<number>(maxDevices);
    const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

    useEffect(() => {
        if (tenant?.id) {
            fetchData();
            
            // Suscribirse a cambios en active_devices para el tiempo real
            const channel = supabase.channel('devices_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'active_devices', filter: `tenant_id=eq.${tenant.id}` }, () => {
                    fetchData();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            }
        }
    }, [tenant?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empRes, devRes, subRes] = await Promise.all([
                supabase.from('employees').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
                supabase.from('active_devices').select('*, employee:employees(*)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
                supabase.from('saas_subscriptions').select('plan_id, status, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey(max_devices)').eq('tenant_id', tenant.id).eq('status', 'active').maybeSingle()
            ]);
            
            if (empRes.data) setEmployees(empRes.data);
            if (devRes.data) setActiveDevices(devRes.data);
            if (subRes.data && subRes.data.saas_plans) {
                setPlanMaxDevices((subRes.data.saas_plans as any).max_devices || 9999);
            }
        } catch (err) {
            console.error('Error fetching employees data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMaxDevices = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (desiredMaxDevices > planMaxDevices) {
            alert(`No puedes establecer un límite mayor al permitido por tu plan actual (${planMaxDevices === 9999 ? 'Ilimitado' : planMaxDevices}). Si necesitas más espacio, debes cambiar de plan.`);
            setDesiredMaxDevices(maxDevices); // restaurar al valor real
            return;
        }

        if (desiredMaxDevices < 1) {
            alert("El límite mínimo es 1 dispositivo.");
            return;
        }
        
        setIsUpdatingLimit(true);
        try {
            if (desiredMaxDevices < employees.length) {
                const diff = employees.length - desiredMaxDevices;
                // Ordenar por fecha de creación descendente (últimos creados primero)
                const employeesToKill = [...employees].sort((a, b) => new Date((b.created_at as string) || '').getTime() - new Date((a.created_at as string) || '').getTime()).slice(0, diff);
                const idsToKill = employeesToKill.map(e => e.id);
                
                const { error: delError } = await supabase.from('employees').delete().in('id', idsToKill);
                if (delError) throw delError;
                alert(`Límite reducido. Se han eliminado ${diff} cuentas automáticamente para ajustarse al nuevo límite (los creados más recientemente).`);
            }
            
            const { error: upError } = await supabase.from('tenants').update({ max_devices: desiredMaxDevices }).eq('id', tenant.id);
            if (upError) throw upError;
            
            alert("Límite actualizado exitosamente.");
            // Actualización local momentánea para UX fluida
            tenant.max_devices = desiredMaxDevices;
            fetchData();
        } catch(err) {
            console.error(err);
            alert("Error actualizando límite. Intenta de nuevo.");
        } finally {
            setIsUpdatingLimit(false);
        }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empName || !empPin) return;
        
        if (employees.length >= maxDevices) {
            if (maxDevices < planMaxDevices) {
                alert(`Has alcanzado el límite de personal configurado (${maxDevices}). Aumenta el "Límite Permitido" arriba para poder registrar más personal.`);
            } else {
                alert(`Has alcanzado el límite máximo de tu plan (${planMaxDevices} empleados/dispositivos). Elimina alguno para añadir otro, o mejora tu suscripción.`);
            }
            return;
        }

        try {
            const { error } = await supabase.from('employees').insert([{
                tenant_id: tenant.id,
                name: empName,
                role: empRole,
                pin_code: empPin
            }]);
            
            if (error) throw error;
            
            setEmpName('');
            setEmpPin('');
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al crear empleado');
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm('¿Seguro que deseas eliminar a este empleado? Perderá acceso instantáneamente.')) return;
        try {
            // Esto también borrará los active_devices por el ON DELETE CASCADE en base de datos
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al eliminar empleado');
        }
    };

    const handleRevokeDevice = async (id: string) => {
        if (!window.confirm('¿Revocar acceso? El dispositivo se bloqueará en tiempo real.')) return;
        try {
            const { error } = await supabase.from('active_devices').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Error al revocar acceso');
        }
    };

    if (loading && employees.length === 0) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

    // Detectar cuentas clonadas
    const empCounts: Record<string, number> = {};
    activeDevices.forEach(d => {
        empCounts[d.employee_id] = (empCounts[d.employee_id] || 0) + 1;
    });

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Cabecera */}
            <div className="glass p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <Shield className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black italic text-white leading-none">Personal y Seguridad</h2>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-blue-400 mt-1">Control de Accesos (Límite activo: {maxDevices} / Plan: {planMaxDevices === 9999 ? 'Ilimitado' : planMaxDevices})</p>
                    </div>
                </div>
                <div className="mt-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex gap-2">
                        <div className="px-4 py-2 bg-slate-900 rounded-xl text-xs font-bold text-slate-300">
                            Cuentas: <span className={employees.length >= maxDevices ? 'text-red-400' : 'text-green-400'}>{employees.length} / {maxDevices}</span>
                        </div>
                        <div className="px-4 py-2 bg-slate-900 rounded-xl text-xs font-bold text-slate-300">
                            Dispositivos Activos: <span className="text-blue-400">{activeDevices.length}</span>
                        </div>
                    </div>
                    
                    {/* Controlador manual de límite */}
                    <form onSubmit={handleUpdateMaxDevices} className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800 ml-auto">
                        <span className="text-[10px] font-bold uppercase text-slate-400 pl-2">Límite Permitido:</span>
                        <input 
                            type="number" 
                            min={1}
                            max={planMaxDevices}
                            value={desiredMaxDevices} 
                            onChange={(e) => setDesiredMaxDevices(parseInt(e.target.value) || 1)}
                            className="w-16 bg-slate-800 text-white text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-blue-500 text-center"
                        />
                        <button 
                            type="submit" 
                            disabled={isUpdatingLimit || desiredMaxDevices === maxDevices}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-1.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Guardar Límite"
                        >
                            {isUpdatingLimit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </button>
                    </form>
                </div>
            </div>

            {/* Crear Empleado */}
            <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Plus size={16} /> Alta de Personal
                </h3>

                {employees.length >= maxDevices && (
                    maxDevices < planMaxDevices ? (
                        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle className="text-blue-400 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="text-blue-400 font-black text-xs uppercase tracking-widest">Límite Permitido Alcanzado</h4>
                                <p className="text-blue-300/80 text-[10px] mt-1 leading-relaxed pr-4">
                                    Actualmente tienes {employees.length} cuentas registradas, alcanzando tu límite permitido actual de {maxDevices}. 
                                    Como tu plan actual te permite tener hasta {planMaxDevices === 9999 ? 'ilimitadas' : planMaxDevices} cuentas, si deseas agregar más personal sólo debes modificar e incrementar el campo **"Límite Permitido"** arriba en el panel de control y guardar los cambios.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="text-amber-500 font-black text-xs uppercase tracking-widest">Límite de Plan Alcanzado</h4>
                                <p className="text-amber-400/80 text-[10px] mt-1 leading-relaxed pr-4">
                                    Actualmente tienes {employees.length} cuentas registradas y tu plan actual permite un máximo de {planMaxDevices}. Para poder añadir a más miembros de tu equipo, necesitas liberar espacio o mejorar tu suscripción.
                                </p>
                                <button 
                                    type="button"
                                    onClick={() => alert("Para ampliar el límite a 6 cuentas (Plan Avanzado) o ilimitado, comunícate con el administrador del sistema para solicitar el Upgrade de tu franquicia.")}
                                    className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                >
                                    Mejorar Suscripción
                                </button>
                            </div>
                        </div>
                    )
                )}

                <form onSubmit={handleCreateEmployee} className={`grid grid-cols-1 md:grid-cols-4 gap-4 transition-opacity duration-300 ${employees.length >= maxDevices ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                    <input 
                        type="text" 
                        placeholder="Nombre (Ej: Pepita)" 
                        value={empName} 
                        onChange={e => setEmpName(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                        required
                    />
                    <select 
                        value={empRole} 
                        onChange={e => setEmpRole(e.target.value as UserRole)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                    >
                        {ROLES.filter(r => r.id !== 'admin').map(r => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                    </select>
                    <input 
                        type="text" 
                        placeholder="Clave (max 8 char)" 
                        maxLength={8}
                        value={empPin} 
                        onChange={e => setEmpPin(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                        required
                    />
                    <button 
                        type="submit"
                        disabled={employees.length >= maxDevices}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        Registrar
                    </button>
                </form>
            </div>

            {/* Lista de Empleados */}
            <div className="glass p-6 rounded-3xl border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Plantilla Actual</h3>
                <div className="space-y-2">
                    {employees.map(emp => (
                        <div key={emp.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                            <div>
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    {emp.name}
                                    <span className="px-2 py-1 bg-slate-800 rounded-md text-[9px] uppercase tracking-wider text-slate-400">
                                        {ROLES.find(r => r.id === emp.role)?.label || emp.role}
                                    </span>
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500">Clave:</span>
                                    <span className="font-mono text-blue-400 text-sm bg-blue-500/10 px-2 py-0.5 rounded">
                                        {showPinId === emp.id ? emp.pin_code : '••••••••'}
                                    </span>
                                    <button onClick={() => setShowPinId(showPinId === emp.id ? null : emp.id)} className="text-slate-500 hover:text-white">
                                        {showPinId === emp.id ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {employees.length === 0 && <p className="text-center text-sm text-slate-500 py-4">No hay empleados registrados</p>}
                </div>
            </div>

            {/* Sesiones y Dispositivos */}
            <div className="glass p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Smartphone size={16} /> Dispositivos en Tiempo Real
                    </h3>
                    <button onClick={fetchData} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors">
                        <RefreshCw size={14} />
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeDevices.map(dev => {
                        const isCloned = empCounts[dev.employee_id] > 1;
                        return (
                            <div key={dev.id} className={`p-5 rounded-2xl border flex flex-col relative overflow-hidden ${isCloned ? 'bg-red-500/10 border-red-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                {isCloned && (
                                    <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[9px] font-black uppercase text-center py-0.5 tracking-widest animate-pulse">
                                        ¡Alerta: Uso simultáneo detectado!
                                    </div>
                                )}
                                <div className="flex justify-between items-start mt-2">
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {dev.employee?.name || 'Desconocido'}
                                            {isCloned && <AlertTriangle size={14} className="text-red-400" />}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase">
                                            {dev.user_agent.substring(0, 30)}...
                                        </p>
                                        <p className="text-[9px] text-slate-500 font-mono mt-1">ID: {dev.device_fingerprint.split('-')[0]}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleRevokeDevice(dev.id)}
                                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
                                    >
                                        <XCircle size={14} /> Revocar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {activeDevices.length === 0 && <p className="text-sm text-slate-500 py-4 col-span-2">No hay dispositivos conectados ahora.</p>}
                </div>
            </div>

        </div>
    );
};
