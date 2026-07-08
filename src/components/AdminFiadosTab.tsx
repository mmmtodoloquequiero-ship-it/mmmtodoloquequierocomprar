'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle, Search, UserPlus, CreditCard, Star, DollarSign, X } from 'lucide-react';

interface AdminFiadosTabProps {
    tenantId: string;
}

export function AdminFiadosTab({ tenantId }: AdminFiadosTabProps) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [tabs, setTabs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Add Customer
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCust, setNewCust] = useState({ name: '', phone: '', document_number: '', max_limit: 10000 });
    const [globalInfo, setGlobalInfo] = useState<any>(null);
    const [checkingDni, setCheckingDni] = useState(false);

    // Modal Pay
    const [showPayModal, setShowPayModal] = useState<any>(null);
    const [payAmount, setPayAmount] = useState<number | ''>('');

    const fetchData = async () => {
        setLoading(true);
        // Fetch local customers with fiado
        const { data: custs } = await supabase
            .from('customers')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('document_number', 'is', null);
        
        if (custs) {
            setCustomers(custs.filter(c => c.fiado_status !== 'pending'));
            setPendingRequests(custs.filter(c => c.fiado_status === 'pending'));
        }

        // Fetch active tabs
        const { data: activeTabs } = await supabase
            .from('customer_tabs')
            .select('*, customers(*)')
            .eq('tenant_id', tenantId)
            .eq('is_settled', false);
        
        if (activeTabs) setTabs(activeTabs);
        setLoading(false);
    };

    useEffect(() => {
        if (tenantId) fetchData();
    }, [tenantId]);

    const checkGlobalDni = async (dni: string) => {
        if (!dni || dni.length < 7) return;
        setCheckingDni(true);
        const { data } = await supabase
            .from('global_customers')
            .select('*')
            .eq('document_number', dni)
            .maybeSingle();
        setGlobalInfo(data || { not_found: true });
        setCheckingDni(false);
    };

    const handleAddCustomer = async () => {
        if (!newCust.name || !newCust.document_number) return alert('Nombre y DNI obligatorios');
        
        // 1. Check if exists locally
        const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('document_number', newCust.document_number)
            .maybeSingle();

        if (existing) {
            return alert('Este DNI ya está registrado en tu local.');
        }

        // 2. Insert into global if not exists
        if (globalInfo?.not_found) {
            await supabase.from('global_customers').insert({
                document_number: newCust.document_number,
                first_name: newCust.name,
                last_name: '',
                phone: newCust.phone
            });
        }

        // 3. Insert local
        const { error } = await supabase.from('customers').insert({
            tenant_id: tenantId,
            name: newCust.name,
            phone: newCust.phone,
            document_number: newCust.document_number,
            max_credit_limit: newCust.max_limit,
            terms_accepted: true // Supongamos que el admin ya recabó la firma
        });

        if (error) {
            alert('Error al crear cliente: ' + error.message);
        } else {
            alert('Cliente habilitado para Fiado');
            setShowAddModal(false);
            setNewCust({ name: '', phone: '', document_number: '', max_limit: 10000 });
            setGlobalInfo(null);
            fetchData();
        }
    };

    const handleApproveRequest = async (customerId: string, dni: string, name: string, phone: string, limit: number) => {
        // Asegurar que exista en global
        await checkGlobalDni(dni);
        if (globalInfo?.not_found) {
            await supabase.from('global_customers').insert({
                document_number: dni,
                first_name: name,
                last_name: '',
                phone: phone
            });
        }
        
        await supabase.from('customers').update({ 
            fiado_status: 'approved',
            max_credit_limit: limit
        }).eq('id', customerId);
        
        alert('Cliente aprobado y dado de alta en Fiado.');
        fetchData();
    };

    const handleRejectRequest = async (customerId: string) => {
        if (!confirm('¿Rechazar esta solicitud?')) return;
        await supabase.from('customers').update({ fiado_status: 'rejected' }).eq('id', customerId);
        fetchData();
    };

    const handleRegisterPayment = async () => {
        if (!showPayModal || !payAmount || payAmount <= 0) return;
        
        const tab = showPayModal;
        const newPaid = Number(tab.amount_paid) + Number(payAmount);
        const settled = newPaid >= tab.total_debt;

        // 1. Insert Payment
        await supabase.from('customer_tab_payments').insert({
            tenant_id: tenantId,
            customer_tab_id: tab.id,
            amount: payAmount,
            payment_method: 'efectivo',
            notes: 'Cobro manual por Admin'
        });

        // 2. Update Tab
        await supabase.from('customer_tabs')
            .update({ 
                amount_paid: newPaid, 
                is_settled: settled,
                is_locked: settled ? false : tab.is_locked
            })
            .eq('id', tab.id);

        alert('Pago registrado correctamente');
        setShowPayModal(null);
        setPayAmount('');
        fetchData();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div>
                    <h2 className="text-white font-black uppercase text-xl flex items-center gap-2">
                        <CreditCard className="text-amber-500" />
                        Gestión de Fiados
                    </h2>
                    <p className="text-slate-400 text-sm">Administra las cuentas corrientes de tus clientes frecuentes.</p>
                </div>
                <button 
                    onClick={() => {
                        setNewCust({ name: '', phone: '', document_number: '', max_limit: 10000 });
                        setGlobalInfo(null);
                        setShowAddModal(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center"
                >
                    <UserPlus size={18} />
                    Habilitar Nuevo Cliente
                </button>
            </div>

            {pendingRequests.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 space-y-4">
                    <h3 className="text-indigo-400 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <AlertCircle size={18} /> Solicitudes Pendientes ({pendingRequests.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="bg-slate-900 border border-indigo-500/20 p-4 rounded-xl flex flex-col gap-3">
                                <div>
                                    <h4 className="text-white font-bold">{req.name}</h4>
                                    <p className="text-slate-400 text-xs">DNI: {req.document_number} | Tel: {req.phone}</p>
                                    <p className="text-indigo-400 text-[10px] mt-1">Solicitado digitalmente (IP guardada)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Límite $"
                                        id={`limit-${req.id}`}
                                        defaultValue={10000}
                                        className="bg-slate-950 border border-slate-800 text-white px-3 py-2 rounded-lg w-28 text-sm outline-none"
                                    />
                                    <button 
                                        onClick={() => {
                                            const limit = parseFloat((document.getElementById(`limit-${req.id}`) as HTMLInputElement).value);
                                            handleApproveRequest(req.id, req.document_number, req.name, req.phone, limit);
                                        }}
                                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1"
                                    >
                                        Aprobar
                                    </button>
                                    <button 
                                        onClick={() => handleRejectRequest(req.id)}
                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Rechazar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Resumen de Deudas Activas */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <h3 className="font-bold text-white mb-4">Cuentas Corrientes Activas (Deudores)</h3>
                
                {loading ? (
                    <p className="text-slate-500 text-sm italic">Cargando cuentas...</p>
                ) : tabs.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No hay cuentas con deuda pendiente.</p>
                ) : (
                    <div className="space-y-3">
                        {tabs.map(tab => (
                            <div key={tab.id} className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-bold text-sm">{tab.customers?.name} <span className="text-slate-500 text-xs font-normal ml-2">DNI: {tab.customers?.document_number}</span></h4>
                                    <p className="text-xs text-slate-400 mt-1">Período: {tab.period_start} al {tab.period_end}</p>
                                    {tab.is_locked && <span className="inline-block mt-2 text-[10px] bg-red-500/20 text-red-500 px-2 py-1 rounded-md font-bold uppercase">Bloqueado por Mora</span>}
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-white">${Number(tab.total_debt - tab.amount_paid).toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500">Total: ${tab.total_debt} | Pagado: ${tab.amount_paid}</p>
                                    <button 
                                        onClick={() => setShowPayModal(tab)}
                                        className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold"
                                    >
                                        Registrar Cobro
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>

            {/* Modal Alta */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-white">Habilitar Fiado a Cliente</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400">DNI del Cliente</label>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        type="number"
                                        value={newCust.document_number}
                                        onChange={e => setNewCust({...newCust, document_number: e.target.value})}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                                        placeholder="Ej: 30123456"
                                    />
                                    <button 
                                        onClick={() => checkGlobalDni(newCust.document_number)}
                                        disabled={checkingDni}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs"
                                    >
                                        {checkingDni ? '...' : 'Verificar'}
                                    </button>
                                </div>
                            </div>

                            {globalInfo && !globalInfo.not_found && (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl">
                                    <p className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={14}/> Cliente encontrado en red global</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Star size={14} className="text-amber-400 fill-amber-400" />
                                        <span className="text-white text-sm font-bold">{globalInfo.global_rating} / 5</span>
                                        <span className="text-xs text-slate-400 ml-2">Impagos: {globalInfo.total_defaults}</span>
                                    </div>
                                </div>
                            )}

                            {globalInfo?.not_found && (
                                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                                    <p className="text-xs text-amber-400 font-bold flex items-center gap-1"><AlertCircle size={14}/> Cliente nuevo en la red</p>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-400">Nombre Completo</label>
                                <input 
                                    type="text"
                                    value={newCust.name}
                                    onChange={e => setNewCust({...newCust, name: e.target.value})}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-400">Teléfono (WhatsApp)</label>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        type="tel"
                                        value={newCust.phone}
                                        onChange={e => setNewCust({...newCust, phone: e.target.value})}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                                        placeholder="Ej: +54911..."
                                    />
                                    <button 
                                        onClick={() => {
                                            if (!newCust.phone) return alert('Ingresa un teléfono primero');
                                            const publicLink = `${window.location.origin}/${tenantId}`;
                                            const msg = `¡Hola ${newCust.name || ''}! 👋\nPara habilitar tu cuenta corriente (fiado) necesitamos tu confirmación.\n\nAl responder "ACEPTO" a este mensaje, confirmas que aceptas nuestros Términos y Condiciones (ver aquí: ${publicLink}) y permites que tu historial de pagos sea registrado.\n\n¿Aceptas?`;
                                            window.open(`https://wa.me/${newCust.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
                                        }}
                                        className="bg-[#25D366] hover:bg-[#1da851] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1"
                                        title="Enviar WhatsApp de Consentimiento"
                                    >
                                        Enviar WhatsApp
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-400">Límite de Fiado Máximo ($)</label>
                                <input 
                                    type="number"
                                    value={newCust.max_limit}
                                    onChange={e => setNewCust({...newCust, max_limit: Number(e.target.value)})}
                                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white"
                                />
                            </div>
                            
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-2">
                                <p className="text-[10px] text-amber-400">Al dar de alta al cliente, certificas que has recabado su consentimiento explícito para gestionar su deuda en el sistema, de acuerdo a los Términos y Condiciones vigentes.</p>
                                <div className="flex gap-2 p-2 bg-amber-500/20 rounded-lg items-start border border-amber-500/30">
                                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] font-bold text-amber-500 leading-tight">Te recomiendo que para dar de alta a una persona verifiques su número de identidad con su documento en mano.</p>
                                </div>
                            </div>

                            <button onClick={handleAddCustomer} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl">
                                Dar de Alta Cliente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Pay */}
            {showPayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-white">Registrar Cobro Manual</h3>
                            <button onClick={() => setShowPayModal(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div>
                            <p className="text-sm text-slate-300">Cobro a cuenta de: <b className="text-white">{showPayModal.customers?.name}</b></p>
                            <p className="text-xs text-slate-500 mt-1">Saldo deudor: ${Number(showPayModal.total_debt - showPayModal.amount_paid)}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400">Monto a abonar en Efectivo ($)</label>
                            <input 
                                type="number"
                                value={payAmount}
                                onChange={e => setPayAmount(Number(e.target.value))}
                                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-lg text-center"
                                placeholder="0.00"
                            />
                        </div>
                        <button onClick={handleRegisterPayment} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/20">
                            Confirmar Pago
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
