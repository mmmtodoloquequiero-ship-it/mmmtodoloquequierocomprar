const fs = require('fs');
const file = 'src/components/AdminTab.tsx';
let content = fs.readFileSync(file, 'utf8');

const t1 = "    }, [tenant, refetchData]);\n\n    const [view, setView] = useState<'dashboard' | 'stock' | 'products' | 'balance' | 'sales' | 'config' | 'tables' | 'fiscal' | 'reports' | 'loyalty' | 'employees' | 'subscription'>('dashboard');\n    const [lockedFeatureModal, setLockedFeatureModal] = useState<string | null>(null);";
const r1 = `    }, [tenant, refetchData]);

    const [view, setView] = useState<'dashboard' | 'stock' | 'products' | 'balance' | 'sales' | 'config' | 'tables' | 'fiscal' | 'reports' | 'loyalty' | 'employees' | 'subscription'>('dashboard');
    const [subscription, setSubscription] = useState<any>(null);
    const [lockedFeatureModal, setLockedFeatureModal] = useState<string | null>(null);

    useEffect(() => {
        if (tenant?.id) {
            supabase
                .from('saas_subscriptions')
                .select('status, current_period_end, trial_started_at, saas_plans(name)')
                .eq('tenant_id', tenant.id)
                .maybeSingle()
                .then(({ data }) => setSubscription(data));
        }
    }, [tenant?.id]);`;

const t2 = '                                return (\n        <div className="space-y-6 pb-4 max-w-5xl mx-auto px-2">\n            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide">';
const r2 = `                                return (
        <div className="space-y-6 pb-4 max-w-5xl mx-auto px-2">
            {/* SaaS Trial Banner */}
            {subscription && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    {subscription.status === 'pending_trial' && (
                        <div className="bg-slate-800/80 border border-slate-700/50 p-4 rounded-2xl flex items-center justify-between text-slate-300">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">⏳</span>
                                <div>
                                    <h4 className="font-bold text-sm text-white">Todavía no iniciaste tu prueba</h4>
                                    <p className="text-xs">Tus 14 días gratuitos de <strong className="text-purple-400">Pro Ilimitado</strong> comenzarán cuando registres tu primera venta.</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {subscription.status === 'trial' && subscription.current_period_end && (
                        <div className="bg-gradient-to-r from-orange-500/20 to-purple-600/20 border border-orange-500/30 p-4 rounded-2xl flex items-center justify-between text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl animate-pulse">🔥</span>
                                <div>
                                    <h4 className="font-black text-sm uppercase text-orange-400">Período de Prueba Activo</h4>
                                    <p className="text-xs">
                                        Te quedan <strong className="text-xl">
                                            {Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                                        </strong> días gratis del plan <strong className="text-purple-400">{subscription?.saas_plans?.name || 'Pro Ilimitado'}</strong>.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setView('config'); setExpandedConfigSection('subscription'); }}
                                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap"
                            >
                                Ver Planes
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide">`;

const normalize = s => s.replace(/\\r\\n/g, '\\n');
content = normalize(content);

if (!content.includes(t1)) console.error("t1 not found");
if (!content.includes(t2)) console.error("t2 not found");

content = content.replace(t1, normalize(r1));
content = content.replace(t2, normalize(r2));

fs.writeFileSync(file, content);
console.log("Done");
