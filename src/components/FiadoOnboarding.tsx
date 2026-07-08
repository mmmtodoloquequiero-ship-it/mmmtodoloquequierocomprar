'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface FiadoOnboardingProps {
    tenantId: string;
    onVerified: (customerId: string) => void;
}

export function FiadoOnboarding({ tenantId, onVerified }: FiadoOnboardingProps) {
    const [step, setStep] = useState<'dni_check' | 'register' | 'pending' | 'rejected' | 'locked' | 'approved'>('dni_check');
    const [dni, setDni] = useState('');
    const [loading, setLoading] = useState(false);
    const [globalError, setGlobalError] = useState('');
    
    // Register form
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    
    const checkDni = async () => {
        if (!dni || dni.length < 6) return alert('Ingresa un DNI válido');
        setLoading(true);
        try {
            // 0. Verificar reputación global ("Veraz de Barrio")
            const { data: globalCustomer } = await supabase
                .from('global_customers')
                .select('*')
                .eq('document_number', dni)
                .maybeSingle();

            if (globalCustomer && globalCustomer.total_defaults > 0) {
                setGlobalError(`Tu solicitud ha sido denegada automáticamente debido a que registrás ${globalCustomer.total_defaults} cuenta(s) impaga(s) en la red de comercios locales. Calificación actual: ${globalCustomer.global_rating}/5.`);
                setStep('rejected');
                setLoading(false);
                return;
            }

            // 1. Buscar si ya es cliente en este local
            const { data: customer, error } = await supabase
                .from('customers')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('document_number', dni)
                .single();

            if (customer) {
                // Verificar estado de la solicitud
                if (customer.fiado_status === 'pending') {
                    setStep('pending');
                } else if (customer.fiado_status === 'rejected') {
                    setStep('rejected');
                } else {
                    // Está aprobado. Ahora verificar si tiene bloqueos por mora en customer_tabs
                    const { data: tabs } = await supabase
                        .from('customer_tabs')
                        .select('is_locked')
                        .eq('customer_id', customer.id)
                        .eq('is_settled', false)
                        .order('created_at', { ascending: false })
                        .limit(1);
                        
                    if (tabs && tabs.length > 0 && tabs[0].is_locked) {
                        setStep('locked');
                    } else {
                        setStep('approved');
                        onVerified(customer.id);
                    }
                }
            } else {
                // No existe, pasar al registro
                setStep('register');
            }
        } catch (err) {
            console.error(err);
            setStep('register');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!name || !phone || !acceptedTerms) {
            return alert('Completa todos los campos y acepta los Términos y Condiciones.');
        }

        setLoading(true);
        try {
            // Obtener IP y User Agent
            const res = await fetch('/api/fiado-request');
            const geoData = await res.json();

            const { data, error } = await supabase.from('customers').insert({
                tenant_id: tenantId,
                document_number: dni,
                name,
                phone,
                terms_accepted: true,
                terms_accepted_at: new Date().toISOString(),
                terms_ip_address: geoData.ip,
                terms_user_agent: geoData.userAgent,
                fiado_status: 'pending',
                max_credit_limit: 0 // Se lo asigna el admin al aprobar
            }).select().single();

            if (error) throw error;
            setStep('pending');
        } catch (err) {
            console.error(err);
            alert('Error al enviar la solicitud. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mt-4 animate-in fade-in slide-in-from-top-2">
            
            {step === 'dni_check' && (
                <div className="space-y-3">
                    <h4 className="text-indigo-400 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} /> Identificación Requerida
                    </h4>
                    <p className="text-xs text-slate-300 mb-2">
                        Para pagar con Cuenta Corriente (Fiado) necesitamos validar tu identidad.
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="number"
                            value={dni}
                            onChange={e => setDni(e.target.value)}
                            placeholder="Tu número de DNI"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                        />
                        <button 
                            onClick={checkDni}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                        </button>
                    </div>
                </div>
            )}

            {step === 'register' && (
                <div className="space-y-4">
                    <h4 className="text-indigo-400 font-black uppercase text-[10px] tracking-widest">Solicitud de Cuenta</h4>
                    <p className="text-xs text-slate-300">
                        No encontramos una cuenta asociada a este DNI. Completa tus datos para enviar la solicitud al local.
                    </p>
                    
                    <div className="space-y-3">
                        <input 
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nombre y Apellido"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                        />
                        <input 
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="WhatsApp (Ej: +54911...)"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                        />
                        
                        <div className="flex items-start gap-3 mt-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                            <input 
                                type="checkbox" 
                                id="terms"
                                checked={acceptedTerms}
                                onChange={e => setAcceptedTerms(e.target.checked)}
                                className="mt-1 w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="terms" className="text-[10px] text-slate-400 cursor-pointer">
                                Declaro que los datos son correctos y acepto los <a href="/terminos-fiado" target="_blank" rel="noopener noreferrer" className="font-extrabold underline text-indigo-400">Términos y Condiciones del Servicio</a>. Autorizo expresamente que mi historial de pagos sea registrado en el sistema para la evaluación de mi límite de crédito. (Se registrará tu IP {`y`} dispositivo como firma digital).
                            </label>
                        </div>

                        <button 
                            onClick={handleRegister}
                            disabled={loading || !acceptedTerms}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 mt-2"
                        >
                            {loading ? 'Enviando...' : 'Enviar Solicitud'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'pending' && (
                <div className="text-center py-4 space-y-3">
                    <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Clock size={24} className="animate-pulse" />
                    </div>
                    <h4 className="font-bold text-white">Solicitud en Revisión</h4>
                    <p className="text-xs text-slate-400">
                        El dueño del local está revisando tu perfil. Vuelve a intentar más tarde o comunícate con el mostrador. No puedes realizar compras con Fiado en este momento.
                    </p>
                </div>
            )}

            {step === 'rejected' && (
                <div className="text-center py-4 space-y-3">
                    <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <X size={24} />
                    </div>
                    <h4 className="font-bold text-white">Solicitud Rechazada</h4>
                    <p className="text-xs text-slate-400">
                        {globalError || 'Tu solicitud de cuenta corriente no fue aprobada por el local. Por favor, utiliza otro método de pago.'}
                    </p>
                </div>
            )}

            {step === 'locked' && (
                <div className="text-center py-4 space-y-3">
                    <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertCircle size={24} />
                    </div>
                    <h4 className="font-bold text-white">Cuenta Bloqueada</h4>
                    <p className="text-xs text-slate-400">
                        Tienes deuda pendiente vencida en el local. No puedes realizar nuevos pedidos con Fiado hasta regularizar tu situación.
                    </p>
                </div>
            )}

            {step === 'approved' && (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                    <CheckCircle className="text-green-500 shrink-0" size={24} />
                    <div>
                        <h4 className="font-bold text-white text-xs">Identidad Verificada</h4>
                        <p className="text-[10px] text-green-400">Puedes continuar con tu pedido usando tu Cuenta Corriente.</p>
                    </div>
                </div>
            )}
            
        </div>
    );
}

// Stub para Clock y X ya que no las importé arriba
function Clock({ size, className }: any) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function X({ size, className }: any) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
}
