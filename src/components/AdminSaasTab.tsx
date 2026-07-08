import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, CreditCard, Gift, Clock, AlertTriangle, CheckCircle, Loader2, Sparkles } from 'lucide-react';

export const AdminSaasTab = ({ tenantId }: { tenantId: string }) => {
    const [sub, setSub] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

    const fetchSub = async () => {
        const { data, error } = await supabase
            .from('saas_subscriptions')
            .select(`*, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey(*)`)
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (data) setSub(data);
    };

    const fetchPlans = async () => {
        const { data, error } = await supabase
            .from('saas_plans')
            .select('*')
            .eq('is_active', true)
            .order('price_ars', { ascending: true });
        if (data) setPlans(data);
    };

    const checkDowngradeAndFetch = async () => {
        setLoading(true);
        await Promise.all([fetchSub(), fetchPlans()]);
        setLoading(false);
    };

    useEffect(() => {
        checkDowngradeAndFetch();
    }, [tenantId]);

    const handleRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!couponCode) return;
        setIsRedeeming(true);
        const { data, error } = await supabase.rpc('redeem_saas_discount_code', {
            p_code: couponCode.trim().toUpperCase(),
            p_tenant_id: tenantId
        });

        if (error) {
            alert('Error de conexión.');
        } else if (data?.success) {
            alert(data.message);
            setCouponCode('');
            await checkDowngradeAndFetch();
        } else {
            alert(data?.message || 'Cupón inválido.');
        }
        setIsRedeeming(false);
    };

    const handleDismissAlert = async () => {
        try {
            await supabase.rpc('dismiss_downgrade_alert', {
                p_tenant_id: tenantId
            });
            setSub((prev: any) => prev ? { ...prev, show_downgrade_alert: false } : null);
        } catch (e) {
            console.error('Error al descartar alerta:', e);
        }
    };

    const handleSubscribe = async (planId: string) => {
        setSubscribingPlanId(planId);
        try {
            const res = await fetch('/api/mercadopago/subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId,
                    planId
                })
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                alert(data.error || 'Error al iniciar la suscripción con Mercado Pago.');
            } else if (data.init_point) {
                // Redirigir a Mercado Pago para completar la suscripción
                window.location.href = data.init_point;
            } else {
                alert('No se pudo obtener la pasarela de pago.');
            }
        } catch (error) {
            console.error('Error en handleSubscribe:', error);
            alert('Error de red al intentar suscribirse.');
        } finally {
            setSubscribingPlanId(null);
        }
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm('¿Estás seguro de que deseas cancelar tu suscripción? Dejarás de tener acceso a las funciones pagas al final de tu período actual.')) return;
        
        setLoading(true);
        try {
            const res = await fetch('/api/mercadopago/cancel-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tenantId })
            });
            const data = await res.json();
            
            if (data.success) {
                alert('Suscripción cancelada exitosamente.');
                await checkDowngradeAndFetch();
            } else {
                alert(data.error || 'Error al cancelar la suscripción.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error de red al intentar cancelar.');
        }
        setLoading(false);
    };

    const formatARS = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(amount);
    };

    if (loading) return <div className="flex justify-center p-12 text-amber-500"><Loader2 className="animate-spin" size={32} /></div>;

    const isPastDue = sub?.current_period_end && new Date(sub.current_period_end) < new Date();
    const hasActiveDiscount = sub?.discount_percentage > 0 && sub?.discount_ends_at && new Date(sub.discount_ends_at) > new Date();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                Mi Suscripción <ShieldAlert className="text-amber-500" />
            </h2>


            {isPastDue && !sub?.show_downgrade_alert && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-red-500 font-black text-sm uppercase">Suscripción Vencida</h4>
                        <p className="text-red-400/80 text-xs mt-1">Tu plan ha expirado. Por favor, selecciona un plan para suscribirte mediante Mercado Pago o ingresa un código promocional.</p>
                    </div>
                </div>
            )}

            {/* Información actual & Canje de Códigos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
                    
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <Clock size={16} /> Estado Actual
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Plan Activo</p>
                            <div className="flex items-center justify-between">
                                <p className="text-2xl font-black text-white">{sub?.saas_plans?.name || 'Trial (Prueba)'}</p>
                                {sub?.status === 'active' && (
                                    <button 
                                        onClick={handleCancelSubscription}
                                        className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                    >
                                        Cancelar Suscripción
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Vencimiento</p>
                            <p className={`text-lg font-black ${isPastDue ? 'text-red-400' : 'text-emerald-400'}`}>
                                {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('es-AR') : 'Sin fecha'}
                            </p>
                        </div>
                        {hasActiveDiscount && (
                            <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl mt-2">
                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">Descuento Activo</p>
                                <p className="text-lg font-black text-purple-300">{sub.discount_percentage}% OFF</p>
                                <p className="text-[9px] text-purple-400/80 mt-1">Válido hasta: {new Date(sub.discount_ends_at).toLocaleDateString('es-AR')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
                    
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <Gift size={16} /> Código Promocional
                    </h3>

                    <form onSubmit={handleRedeem} className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Ingresa tu código único</label>
                            <input 
                                type="text" 
                                required
                                value={couponCode}
                                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                placeholder="EJ: PROMO50"
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 text-center font-black tracking-widest uppercase transition-colors"
                            />
                        </div>
                        
                        <button 
                            type="submit"
                            disabled={isRedeeming}
                            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-black uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {isRedeeming ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} 
                            Canjear Código
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-500 mt-4 leading-relaxed text-center">Si recibiste un cupón de extensión de prueba o descuento del administrador, ingrésalo aquí.</p>
                </div>
            </div>

            {/* Listado de Planes de Suscripción */}
            <div className="space-y-4 pt-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Sparkles className="text-yellow-500" size={16} /> Planes Disponibles
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const isCurrentPlan = sub?.plan_id === plan.id;
                        const featuresList = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
                        
                        // Calcular precio aplicando descuento promocional si existe y corresponde
                        let displayPrice = plan.price_ars;
                        if (hasActiveDiscount) {
                            displayPrice = Math.round(plan.price_ars * (1 - sub.discount_percentage / 100));
                        }

                        return (
                            <div 
                                key={plan.id} 
                                className={`glass p-6 rounded-3xl border flex flex-col justify-between transition-all relative overflow-hidden group ${
                                    isCurrentPlan 
                                        ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-emerald-500/5' 
                                        : 'border-white/5 hover:border-white/20'
                                }`}
                            >
                                {isCurrentPlan && (
                                    <div className="absolute right-0 top-0 bg-emerald-500 text-slate-900 font-bold text-[9px] uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                                        Activo
                                    </div>
                                )}

                                <div>
                                    <h4 className="text-lg font-black text-white">{plan.name}</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 min-h-[30px]">{plan.description}</p>
                                    
                                    <div className="my-6">
                                        {hasActiveDiscount ? (
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-500 line-through font-bold">
                                                    {formatARS(plan.price_ars)}/mes
                                                </span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-white">{formatARS(displayPrice)}</span>
                                                    <span className="text-xs text-purple-400 font-bold">/mes*</span>
                                                </div>
                                                <p className="text-[9px] text-purple-400 font-bold">*Cupón de descuento activo aplicado</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white">{formatARS(displayPrice)}</span>
                                                <span className="text-xs text-slate-400 font-bold">/mes</span>
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-2 border-t border-white/5 pt-4">
                                        {featuresList.map((feat: string, idx: number) => (
                                            <li key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                                <CheckCircle className="text-emerald-500 shrink-0" size={14} />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button
                                    onClick={() => handleSubscribe(plan.id)}
                                    disabled={subscribingPlanId !== null}
                                    className={`mt-8 w-full font-black uppercase tracking-wider py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                        isCurrentPlan
                                            ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'
                                            : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] font-black'
                                    }`}
                                >
                                    {subscribingPlanId === plan.id ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            <CreditCard size={16} />
                                            {isCurrentPlan ? 'Renovar Plan' : 'Elegir Plan'}
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 p-4 border border-white/5 bg-slate-900/50 rounded-xl text-center">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        <strong>¿Cómo cancelar mi plan?</strong> Si deseás dar de baja el cobro automático de tu suscripción, podés hacerlo en cualquier momento haciendo clic en el botón <span className="text-red-400 font-bold">"Cancelar Suscripción"</span> que aparece arriba en la sección "Estado Actual" cuando tenés un plan activo, o desde tu panel de Mercado Pago. Al cancelar, seguirás teniendo acceso a tus funciones Pro hasta que finalice tu período de facturación actual. Luego, tu cuenta pasará al plan Básico.
                    </p>
                </div>
            </div>
        </div>
    );
};
