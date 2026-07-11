import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase as rawSupabase, broadcastTenantChange } from '@/lib/supabase';
import { Product, Ingredient, Order, Expense, OrderStatus, Category, ProductIngredient, IngredientBatch, ProductOffer } from '@/types/database';
import { PRESET_IMAGES, NEON_ICONS } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import { CreditCard, BarChart2, QrCode, FileText, Plus, Trash2, Edit, TrendingUp, DollarSign, Package, Layers, History, ChevronRight, X, Save, Check, Upload, Image as ImageIcon, Wallet, Receipt, ArrowUpCircle, ArrowDownCircle, Calendar, FilterX, Star, StarOff, PieChart, Paintbrush, LayoutGrid, Sun, Moon, CheckCircle, AlertCircle, Loader2, Share2, AlertTriangle, CalendarRange, Trophy, Smartphone, Instagram, Facebook, Phone, Printer, Download, Award, Coins, Search, MessageCircle, Gift, RefreshCw, Settings, ChevronUp, ChevronDown, Users, Truck, Map as MapIcon, Utensils, Lock, Camera, Barcode } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PrintableQRPoster } from './PrintableQRPoster';
import { AdminEmployeeTab } from './AdminEmployeeTab';
import { AdminSaasTab } from './AdminSaasTab';
import { AdminSupportFloatingButton } from './AdminSupportFloatingButton';
import AdminDeliverySettlement from './AdminDeliverySettlement';
import { AdminFiadosTab } from './AdminFiadosTab';
import { GlobalWatermark } from '@/components/GlobalWatermark';
import { ScannerVoiceInput } from './ScannerVoiceInput';

interface AdminTabProps {
    products: Product[];
    categories: Category[];
    ingredients: Ingredient[];
    orders: Order[];
    expenses: Expense[];
    productIngredients: ProductIngredient[];
    ingredientBatches?: IngredientBatch[];
    productOffers?: ProductOffer[];
    tenant?: any;
    onTenantUpdate?: (updatedTenant: any) => void;
    refetchData?: () => void;
    planFeatures?: string[];
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return new Date(dateStr);
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d); // Crea la fecha en 00:00:00 hora local
};

const getOrderRevenue = (o: any) => {
    const isRes = (o as any).coupon_code && (o as any).coupon_code.startsWith('RES-');
    return o.total_price + (isRes ? ((o as any).discount_amount || 0) : 0);
};

const formatWhatsAppNumber = (phoneStr: string): string => {
  let clean = String(phoneStr || '').replace(/\D/g, '');
  if (!clean) return '';
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (clean.length === 10) return '549' + clean;
  if (clean.length === 11 && clean.startsWith('9')) return '54' + clean;
  if (!clean.startsWith('54') && !clean.startsWith('56') && !clean.startsWith('55') && !clean.startsWith('598')) return '549' + clean;
  return clean;
};

const getProductIdsArray = (pIds: any): string[] => {
    if (!pIds) return [];
    if (Array.isArray(pIds)) return pIds;
    
    const strVal = String(pIds).trim();
    if (strVal.startsWith('{') && strVal.endsWith('}')) {
        return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
    }
    if (strVal.startsWith('[') && strVal.endsWith(']')) {
        try {
            return JSON.parse(strVal);
        } catch (e) {
            return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
        }
    }
    return [strVal];
};

const ScheduleEditor = ({ cfg, setCfg, primaryColor }: { cfg: any, setCfg: any, primaryColor: string }) => {
    const days = [
        { id: '1', name: 'Lunes' }, { id: '2', name: 'Martes' }, { id: '3', name: 'Miércoles' },
        { id: '4', name: 'Jueves' }, { id: '5', name: 'Viernes' }, { id: '6', name: 'Sábado' }, { id: '0', name: 'Domingo' }
    ];

    const addShift = (dayId: string) => {
        const newSched = { ...cfg.schedule };
        newSched[dayId] = [...(newSched[dayId] || []), { open: '00:00', close: '23:59' }];
        setCfg({ ...cfg, schedule: newSched });
    };

    const removeShift = (dayId: string, index: number) => {
        const newSched = { ...cfg.schedule };
        newSched[dayId].splice(index, 1);
        setCfg({ ...cfg, schedule: newSched });
    };

    const updateShift = (dayId: string, index: number, field: 'open' | 'close', value: string) => {
        const newSched = { ...cfg.schedule };
        newSched[dayId][index][field] = value;
        setCfg({ ...cfg, schedule: newSched });
    };

    return (
        <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer mb-4 bg-slate-900/60 p-4 rounded-xl border border-white/5 transition-all hover:bg-slate-800/60">
                <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-slate-800"
                />
                <span className="text-sm font-bold text-white">Activar restricción de horarios</span>
            </label>

            {cfg.enabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs text-slate-400 mb-2">
                        Puedes añadir múltiples turnos partidos (ej: de 12:00 a 15:00 y de 20:00 a 23:59). Si no hay turnos, se considera cerrado todo el día. Si cruzas la medianoche (ej: 20:00 a 02:00), el sistema lo calculará correctamente.
                    </p>
                    {days.map(day => (
                        <div key={day.id} className="bg-slate-950/40 p-4 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-bold text-white text-sm">{day.name}</span>
                                <button 
                                    onClick={(e) => { e.preventDefault(); addShift(day.id); }}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-md transition-all hover:scale-105"
                                >
                                    <Plus size={12} /> Añadir Turno
                                </button>
                            </div>
                            
                            {(cfg.schedule[day.id] || []).length === 0 ? (
                                <p className="text-xs text-red-400/80 italic font-bold">Cerrado todo el día</p>
                            ) : (
                                <div className="space-y-2">
                                    {(cfg.schedule[day.id] || []).map((shift: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={shift.open}
                                                onChange={e => updateShift(day.id, idx, 'open', e.target.value)}
                                                className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-white transition-colors"
                                            />
                                            <span className="text-slate-500 text-xs font-black">a</span>
                                            <input
                                                type="time"
                                                value={shift.close}
                                                onChange={e => updateShift(day.id, idx, 'close', e.target.value)}
                                                className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-white transition-colors"
                                            />
                                            <button 
                                                onClick={(e) => { e.preventDefault(); removeShift(day.id, idx); }}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-2 p-1.5 rounded-lg transition-all"
                                                title="Eliminar turno"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AdminTab: React.FC<AdminTabProps> = ({
    products, categories, ingredients, orders, expenses, productIngredients, ingredientBatches = [], productOffers = [], tenant, onTenantUpdate, refetchData, planFeatures = []
}) => {
    const notifyChanges = () => {
        refetchData?.();
        broadcastTenantChange(tenant?.id);
    };

    const [searchTermProducts, setSearchTermProducts] = useState('');
    const [searchTermStock, setSearchTermStock] = useState('');

    // Proxy para interceptar mutaciones y notificar cambios en tiempo real automáticamente
    const supabase = useMemo(() => {
        return new Proxy(rawSupabase, {
            get(target, prop) {
                if (prop === 'from') {
                    return (table: string) => {
                        const builder = rawSupabase.from(table);
                        const originalInsert = builder.insert;
                        const originalUpdate = builder.update;
                        const originalDelete = builder.delete;

                        const wrapExecution = (originalFn: any) => {
                            return (...args: any[]) => {
                                const query = originalFn.apply(builder, args);
                                const originalThen = query.then;
                                query.then = function(onfulfilled: any, onrejected: any) {
                                    return originalThen.call(query, (result: any) => {
                                        if (result && !result.error) {
                                            setTimeout(() => {
                                                notifyChanges();
                                            }, 100);
                                        }
                                        return onfulfilled ? onfulfilled(result) : result;
                                    }, onrejected);
                                };
                                return query;
                            };
                        };

                        builder.insert = wrapExecution(originalInsert);
                        builder.update = wrapExecution(originalUpdate);
                        builder.delete = wrapExecution(originalDelete);

                        return builder;
                    };
                }
                const value = (rawSupabase as any)[prop];
                if (typeof value === 'function') {
                    return value.bind(rawSupabase);
                }
                return value;
            }
        });
    }, [tenant, refetchData]);

    const [view, setView] = useState<'dashboard' | 'stock' | 'products' | 'balance' | 'sales' | 'config' | 'tables' | 'fiscal' | 'reports' | 'loyalty' | 'employees' | 'subscription'>('dashboard');
    const [lockedFeatureModal, setLockedFeatureModal] = useState<string | null>(null);
    const [expandedConfigSection, setExpandedConfigSection] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        if (tenant?.id) {
            supabase
                .from('saas_subscriptions')
                .select('status, current_period_end, trial_started_at, saas_plans(name)')
                .eq('tenant_id', tenant.id)
                .maybeSingle()
                .then(({ data }) => setSubscription(data));
        }
    }, [tenant?.id]);

    const isViewLocked = (v: string): boolean => {
        if (!planFeatures || planFeatures.length === 0) return false;
        
        switch (v) {
            case 'tables':
                return !planFeatures.includes('Panel de Mozos') && !planFeatures.includes('Reservas con Seña');
            case 'loyalty':
                return !planFeatures.includes('Programa de Fidelización');
            case 'reports':
                return !planFeatures.includes('Balance Financiero Avanzado');
            default:
                return false;
        }
    };
    
    // Estados para el Programa de Fidelización (Micro-CRM mmmTodoLoQueQuiero 2026)
    const [loyaltyAccounts, setLoyaltyAccounts] = useState<any[]>([]);
    const [isFetchingLoyalty, setIsFetchingLoyalty] = useState(false);
    const [loyaltySearch, setLoyaltySearch] = useState('');
    const [selectedLoyaltyTier, setSelectedLoyaltyTier] = useState<'all' | 'bronce' | 'plata' | 'oro' | 'dormant'>('all');
    const [editingLoyaltyAccount, setEditingLoyaltyAccount] = useState<any | null>(null);
    const [newBalance, setNewBalance] = useState('');
    const [isSavingLoyaltyConfig, setIsSavingLoyaltyConfig] = useState(false);

    // Estados para editar configuración del club de clientes
    const [loyConfigEnabled, setLoyConfigEnabled] = useState(true);
    const [loyConfigEarnChan, setLoyConfigEarnChan] = useState<'online' | 'salon' | 'both'>('both');
    const [loyConfigRedeemChan, setLoyConfigRedeemChan] = useState<'online' | 'salon' | 'both'>('both');
    const [loyConfigCashbackPct, setLoyConfigCashbackPct] = useState(5);
    
    // Tiers locales para edición
    const [loyConfigTiers, setLoyConfigTiers] = useState<any[]>([
        { name: 'bronce', min_orders: 0, max_orders: 5, cashback_pct: 5, discount_pct: 0 },
        { name: 'plata', min_orders: 6, max_orders: 15, cashback_pct: 7, discount_pct: 3 },
        { name: 'oro', min_orders: 16, max_orders: 99999, cashback_pct: 10, discount_pct: 5 }
    ]);

    const [reportRange, setReportRange] = useState<'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom'>('thisMonth');
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [salesPeriod, setSalesPeriod] = useState<'daily' | 'weekly' | 'yearly'>('daily');
    const [yearlySortOption, setYearlySortOption] = useState<'chrono' | 'highest' | 'lowest'>('chrono');
    const [isClosingBox, setIsClosingBox] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [selectedDaySales, setSelectedDaySales] = useState<{ dayLabel: string; orders: Order[] } | null>(null);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [expandedWeeksState, setExpandedWeeksState] = useState<Record<number, boolean>>({});
    const [expandedModalOrderId, setExpandedModalOrderId] = useState<string | null>(null);

    const qrPrintRef = useRef<HTMLDivElement>(null);
    const handlePrintQR = useReactToPrint({
        contentRef: qrPrintRef,
    });

    const downloadCSV = (filename: string, rows: string[][]) => {
        const csvContent = "\uFEFF" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getFilteredDateRange = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start = new Date(today);
        let end = new Date(today);
        end.setHours(23, 59, 59, 999);

        switch (reportRange) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case 'last7':
                start.setDate(start.getDate() - 6);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case 'lastMonth':
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0);
                break;
            case 'custom':
                start = new Date(customStartDate + 'T00:00:00');
                end = new Date(customEndDate + 'T23:59:59');
                break;
        }
        return { start, end };
    };

    const handleExportSales = () => {
        const { start, end } = getFilteredDateRange();
        const filtered = orders.filter(o => {
            const d = new Date(o.created_at);
            return d >= start && d <= end;
        });

        const rows = [
            ['Fecha', 'Hora', 'Nro Orden', 'Cliente', 'Origen', 'Método Pago', 'Total', 'AFIP Condición', 'AFIP CUIT']
        ];

        filtered.forEach(o => {
            const d = new Date(o.created_at);
            rows.push([
                d.toLocaleDateString('es-AR'),
                d.toLocaleTimeString('es-AR'),
                String(o.order_number || ''),
                o.client_name || 'Consumidor Final',
                o.origin === 'rappi' ? 'Rappi' : o.origin === 'pedidosya' ? 'PedidosYa' : 'Local/Mostrador',
                o.payment_method || 'Efectivo',
                getOrderRevenue(o).toString(),
                (o as any).afip_client_type || 'Consumidor Final',
                (o as any).afip_doc_number || ''
            ]);
        });

        downloadCSV(`Ventas_${start.toLocaleDateString('es-AR').replace(/\//g, '-')}_al_${end.toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`, rows);
    };

    const handleExportProducts = () => {
        const { start, end } = getFilteredDateRange();
        const filtered = orders.filter(o => {
            const d = new Date(o.created_at);
            return d >= start && d <= end;
        });

        const productStats: Record<string, { qty: number, revenue: number, name: string, category: string }> = {};
        
        filtered.forEach(o => {
            o.items?.forEach(item => {
                const prod = products.find(p => p.id === item.product_id);
                if (prod) {
                    if (!productStats[prod.id]) {
                        const cat = categories.find(c => c.id === prod.category_id);
                        productStats[prod.id] = { qty: 0, revenue: 0, name: prod.name, category: cat?.name || 'Sin Categoría' };
                    }
                    productStats[prod.id].qty += item.quantity;
                    productStats[prod.id].revenue += item.quantity * (item.unit_price || prod.price);
                }
            });
        });

        const rows = [['Producto', 'Categoría', 'Unidades Vendidas', 'Recaudación Total', 'Precio Promedio']];
        Object.values(productStats).sort((a, b) => b.qty - a.qty).forEach(s => {
            rows.push([
                s.name,
                s.category,
                s.qty.toString(),
                s.revenue.toString(),
                (s.revenue / s.qty).toFixed(2)
            ]);
        });

        downloadCSV(`RankingProductos_${start.toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`, rows);
    };

    const handleExportWaste = () => {
        const { start, end } = getFilteredDateRange();
        const wasteTx = expenses.filter(e => {
            const d = new Date(e.date || new Date());
            return d >= start && d <= end && (e.type === 'waste' || e.description?.startsWith('Merma:'));
        });

        const rows = [['Fecha', 'Insumo/Concepto', 'Costo Perdido', 'Descripción / Motivo']];
        wasteTx.forEach(w => {
            const d = new Date(w.date || new Date());
            rows.push([
                d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR'),
                w.description?.replace('Merma: ', '').split(' - ')[0] || 'Desconocido',
                (w.amount || 0).toString(),
                w.description || 'Sin descripción'
            ]);
        });

        downloadCSV(`Mermas_${start.toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`, rows);
    };

    const handleExportBoxes = () => {
        const { start, end } = getFilteredDateRange();
        // Agrupar órdenes archivadas por día para simular el cierre
        const archivedOrders = orders.filter(o => o.is_archived);
        const daysMap: Record<string, { total: number, efectivo: number, digital: number, count: number }> = {};
        
        archivedOrders.forEach(o => {
            const d = new Date(o.created_at);
            if (d >= start && d <= end) {
                const dayKey = d.toLocaleDateString('es-AR');
                if (!daysMap[dayKey]) daysMap[dayKey] = { total: 0, efectivo: 0, digital: 0, count: 0 };
                daysMap[dayKey].count += 1;
                daysMap[dayKey].total += o.total_price;
                if (o.payment_method === 'efectivo') {
                    daysMap[dayKey].efectivo += o.total_price;
                } else {
                    daysMap[dayKey].digital += o.total_price;
                }
            }
        });

        const rows = [['Fecha de Cierre', 'Cantidad de Transacciones', 'Efectivo', 'Pagos Digitales (Apps/Tarjetas)', 'Total Recaudado']];
        Object.entries(daysMap).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).forEach(([day, stats]) => {
            rows.push([
                day,
                stats.count.toString(),
                stats.efectivo.toString(),
                stats.digital.toString(),
                stats.total.toString()
            ]);
        });

        downloadCSV(`HistorialCajas_${start.toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`, rows);
    };

    const handleCloseBox = async () => {
        if (!tenant) return;
        const confirmClose = window.confirm(
            "⚠️ ¿Estás seguro de que deseas realizar el Cierre de Caja?\n\nEsto archivará de forma permanente todas las comandas no archivadas del local y dejará la pantalla limpia para la próxima jornada."
        );
        if (!confirmClose) return;

        setIsClosingBox(true);
        try {
            const { error } = await supabase
                .from('orders')
                .update({ is_archived: true })
                .eq('tenant_id', tenant.id)
                .eq('is_archived', false);

            if (error) {
                console.error("Error al realizar el cierre de caja:", error);
                alert("Hubo un error al archivar los pedidos: " + error.message);
            } else {
                alert("✅ ¡Cierre de caja realizado con éxito! Todos los pedidos activos han sido archivados.");
            }
        } catch (err) {
            console.error("Error en handleCloseBox:", err);
            alert("Error de conexión al cerrar la caja.");
        } finally {
            setIsClosingBox(false);
        }
    };

    const lotesPorVencer = useMemo(() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalizar fecha para comparacion correcta de dias
        return (ingredientBatches || []).filter(batch => {
            const exp = parseLocalDate(batch.expiration_date);
            exp.setHours(0, 0, 0, 0);
            const diffTime = exp.getTime() - hoy.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
        }).map(batch => {
            const ing = ingredients.find(i => i.id === batch.ingredient_id);
            const exp = parseLocalDate(batch.expiration_date);
            exp.setHours(0, 0, 0, 0);
            const diffTime = exp.getTime() - hoy.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
                ...batch,
                ingName: ing ? ing.name : 'Insumo Desconocido',
                ingUnit: ing ? ing.unit : 'uds',
                diffDays: diffDays
            };
        });
    }, [ingredientBatches, ingredients]);

    const handleLiquidateBatch = async (batch: any) => {
        const confirmLiquidate = window.confirm(
            `⚠️ ¿Ya liquidaste o retiraste las ${batch.quantity} ${batch.ingUnit} de "${batch.ingName}" correspondientes a este lote?\n\nAl presionar "Aceptar" se removerá este lote de forma permanente del control de alertas.`
        );
        if (!confirmLiquidate) return;

        try {
            const { error } = await supabase.from('ingredient_batches').delete().eq('id', batch.id);
            if (error) {
                console.error("Error al liquidar lote:", error);
                alert("Error al liquidar el lote");
            } else {
                alert("✅ ¡Lote liquidado y removido con éxito del sistema!");
            }
        } catch (err) {
            console.error("Error en handleLiquidateBatch:", err);
            alert("Error de conexión al liquidar el lote");
        }
    };

    const handleShareBox = async () => {
        if (!tenant) return;
        
        const totalFormatted = formatARS(dailyStats.total);
        const efectivoFormatted = formatARS(dailyStats.efectivo);
        const tarjetaFormatted = formatARS(dailyStats.debito + dailyStats.credito);
        const dateStr = new Date().toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const shareText = `📊 *CIERRE DE CAJA DIARIO* 📊\n` +
                          `📍 *Local:* ${tenant.name || 'Mi Local'}\n` +
                          `📅 *Fecha:* ${dateStr} hs\n` +
                          `----------------------------------\n` +
                          `💵 *Efectivo:* ${efectivoFormatted}\n` +
                          `💳 *Tarjeta (Débito + Crédito):* ${tarjetaFormatted}\n` +
                          `----------------------------------\n` +
                          `💰 *TOTAL FACTURADO:* ${totalFormatted}\n` +
                          `----------------------------------\n` +
                          `¡Cierre de caja diario registrado! 🚀`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Cierre de Caja - ${tenant.name}`,
                    text: shareText,
                });
            } catch (err) {
                // Si el usuario cancela la seleccion de compartir o da error, no mostramos nada destructivo
                console.log("Compartir cancelado o con error pasivo", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                alert("📋 ¡Resumen de cierre de caja copiado al portapapeles! Ya puedes pegarlo y compartirlo en tu WhatsApp.");
            } catch (err) {
                console.error("Error al copiar al portapapeles", err);
                alert("No se pudo copiar el texto de forma automática.");
            }
        }
    };

    const handleShareMenuLink = async () => {
        if (!tenant) return;
        const tenantSlug = tenant?.slug || '';
        const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/${tenantSlug}` : `https://mymenulocal.com/${tenantSlug}`;
        
        const shareText = `¡Mirá nuestro menú digital en ${tenant.name || 'nuestro local'}! 🍔\n\nPodés ver todos los productos y hacer tu pedido desde acá:\n${publicUrl}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Menú Digital - ${tenant.name}`,
                    text: shareText,
                    url: publicUrl
                });
            } catch (err) {
                console.log("Compartir cancelado o con error pasivo", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                alert("📋 ¡Enlace copiado al portapapeles! Ya puedes pegarlo y compartirlo en tus redes sociales.");
            } catch (err) {
                console.error("Error al copiar al portapapeles", err);
                alert("No se pudo copiar el enlace de forma automática.");
            }
        }
    };

    // Modal & Filter States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);

    // Waste Modal & Form States
    const [selectedWasteIngredient, setSelectedWasteIngredient] = useState<Ingredient | null>(null);
    const [wasteQty, setWasteQty] = useState('');
    const [wasteReason, setWasteReason] = useState('Vencido');
    const [isSavingWaste, setIsSavingWaste] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [selectedMonthFilter, setSelectedMonthFilter] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<{ month: string; type: 'income' | 'expense' | 'waste' } | null>(null);

    // New Category Form State
    const [catName, setCatName] = useState('');
    const [catIcon, setCatIcon] = useState('🍔');
    const [catTargetDepartments, setCatTargetDepartments] = useState<string[]>(['kitchen']);
    const [catIsOffer, setCatIsOffer] = useState(false);

    // New Product Form State
    const [prodName, setProdName] = useState('');
    const [prodDesc, setProdDesc] = useState('');
    const [prodPrice, setProdPrice] = useState('');
    const [prodImage, setProdImage] = useState(PRESET_IMAGES[0].url);
    const [prodIngredients, setProdIngredients] = useState<ProductIngredient[]>([]);
    const [prodCustomQuestion, setProdCustomQuestion] = useState('');
    const [prodIsQuestionRequired, setProdIsQuestionRequired] = useState(false);
    const [prodSaleByWeight, setProdSaleByWeight] = useState(false);
    const [prodBaseWeight, setProdBaseWeight] = useState('');
    const [prodBaseWeightUnit, setProdBaseWeightUnit] = useState('g');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Stock Form State
    const [stkName, setStkName] = useState('');
    const [stkBarcode, setStkBarcode] = useState('');
    const [stkIsFractionable, setStkIsFractionable] = useState(false);
    const [stkPrice, setStkPrice] = useState('');
    const [stkLevel, setStkLevel] = useState('');
    const [stkUnit, setStkUnit] = useState('uds');
    const [stkMinAlert, setStkMinAlert] = useState('10');
    const [stkTargetDepartments, setStkTargetDepartments] = useState<string[]>(['kitchen']);
    const [stkExpirationDate, setStkExpirationDate] = useState('');
    const [stockUpdateMode, setStockUpdateMode] = useState<'add' | 'set'>('add');
    const [stkQtyToAdd, setStkQtyToAdd] = useState<string>('');

    // Expense Form State
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expType, setExpType] = useState<Expense['type']>('purchase');

    // Brand and Roles configuration State
    const isInitializedRef = useRef<string | null>(null);
    const [cfgName, setCfgName] = useState('');
    const [cfgPrimary, setCfgPrimary] = useState('#f97316');
    const [cfgSecondary, setCfgSecondary] = useState('#1e293b');
    const [cfgMode, setCfgMode] = useState<'light' | 'dark'>('dark');
    const [cfgRoles, setCfgRoles] = useState<string[]>(['staff', 'kitchen', 'delivery', 'bartender']);
    const [cfgStaffPassword, setCfgStaffPassword] = useState('');
    const [cfgKitchenPassword, setCfgKitchenPassword] = useState('');
    const [cfgDeliveryPassword, setCfgDeliveryPassword] = useState('');
    const [cfgBartenderPassword, setCfgBartenderPassword] = useState('');
    const [cfgWaiterPassword, setCfgWaiterPassword] = useState('');
    const [cfgHasDelivery, setCfgHasDelivery] = useState(false);
    const [cfgDeliveryDays, setCfgDeliveryDays] = useState<number[]>([0,1,2,3,4,5,6]);
    const [cfgMercadopagoPublicKey, setCfgMercadopagoPublicKey] = useState('');
    const [cfgMercadopagoAccessToken, setCfgMercadopagoAccessToken] = useState('');
    const [cfgDeliveryZones, setCfgDeliveryZones] = useState<{ name: string; fee: number }[]>([]);
    const [cfgProfilePictureUrl, setCfgProfilePictureUrl] = useState('');
    const [cfgBannerUrl, setCfgBannerUrl] = useState('');
    const [cfgDescription, setCfgDescription] = useState('');
    const [cfgInstagram, setCfgInstagram] = useState('');
    const [cfgFacebook, setCfgFacebook] = useState('');
    const [cfgWhatsapp, setCfgWhatsapp] = useState('');
    const [cfgAddress, setCfgAddress] = useState('');
    const [cfgGoogleMapsUrl, setCfgGoogleMapsUrl] = useState('');
    const [cfgMapsIframe, setCfgMapsIframe] = useState('');
    const [cfgReviewsEnabled, setCfgReviewsEnabled] = useState(true);
    const [cfgReservationsEnabled, setCfgReservationsEnabled] = useState(false);
    const [cfgReservationDepositAmount, setCfgReservationDepositAmount] = useState<number>(0);
    const [cfgTipsEnabled, setCfgTipsEnabled] = useState(false);
    const [cfgTableChargeEnabled, setCfgTableChargeEnabled] = useState(false);
    const [cfgTableChargeAmount, setCfgTableChargeAmount] = useState<number>(0);
    const [catImageUrl, setCatImageUrl] = useState('');
    const [tablesList, setTablesList] = useState<any[]>([]);
    const [newTableName, setNewTableName] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
    const [selectedTableForQr, setSelectedTableForQr] = useState<any | null>(null);
    const [isSavingTables, setIsSavingTables] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [configSuccess, setConfigSuccess] = useState(false);

    // AFIP Config State
    const [cfgAfipEnabled, setCfgAfipEnabled] = useState(false);
    const [cfgAfipCuit, setCfgAfipCuit] = useState('');
    const [cfgAfipPuntoVenta, setCfgAfipPuntoVenta] = useState('1');
    const [cfgAfipCondicionIva, setCfgAfipCondicionIva] = useState('Monotributista');
    const [cfgAfipIsSandbox, setCfgAfipIsSandbox] = useState(true);
    const [cfgAfipCertPath, setCfgAfipCertPath] = useState('');
    const [cfgAfipKeyPath, setCfgAfipKeyPath] = useState('');
    const [isSavingAfip, setIsSavingAfip] = useState(false);
    const [isUploadingCert, setIsUploadingCert] = useState(false);
    const [isUploadingKey, setIsUploadingKey] = useState(false);

    // Delivery Apps Config State
    const [cfgDeliveryAppsEnabled, setCfgDeliveryAppsEnabled] = useState(false);
    const [cfgRappiStoreId, setCfgRappiStoreId] = useState('');
    const [cfgPedidosyaStoreId, setCfgPedidosyaStoreId] = useState('');
    const [cfgDeliveryAppsToken, setCfgDeliveryAppsToken] = useState('');
    const [cfgDeliveryAppsMarkup, setCfgDeliveryAppsMarkup] = useState<number>(0);
    const [cfgDeliveryAppsPanicActive, setCfgDeliveryAppsPanicActive] = useState(false);
    const [cfgDeliveryAppsSchedule, setCfgDeliveryAppsSchedule] = useState<any>({
        monday: { open: '', close: '' },
        tuesday: { open: '', close: '' },
        wednesday: { open: '', close: '' },
        thursday: { open: '', close: '' },
        friday: { open: '', close: '' },
        saturday: { open: '', close: '' },
        sunday: { open: '', close: '' }
    });

    // Business Hours & Delivery Hours State
    const defaultSchedule = {
        "1": [{ open: "00:00", close: "23:59" }],
        "2": [{ open: "00:00", close: "23:59" }],
        "3": [{ open: "00:00", close: "23:59" }],
        "4": [{ open: "00:00", close: "23:59" }],
        "5": [{ open: "00:00", close: "23:59" }],
        "6": [{ open: "00:00", close: "23:59" }],
        "0": [{ open: "00:00", close: "23:59" }]
    };
    const [cfgBusinessHours, setCfgBusinessHours] = useState<any>({
        enabled: false,
        schedule: JSON.parse(JSON.stringify(defaultSchedule))
    });
    const [cfgDeliveryHours, setCfgDeliveryHours] = useState<any>({
        enabled: false,
        schedule: JSON.parse(JSON.stringify(defaultSchedule))
    });
    const [cfgReservationHours, setCfgReservationHours] = useState<any>({
        enabled: false,
        schedule: JSON.parse(JSON.stringify(defaultSchedule))
    });
    const [cfgDeliveryPanic, setCfgDeliveryPanic] = useState(false);

    // Landing Config State
    const [cfgLandingConfig, setCfgLandingConfig] = useState<any>({
        enabled: false,
        hero_style: 'modern',
        interactive_wall_enabled: false,
        hero_video_url: '',
        hero_image_url: '',
        promos: [],
        events: [],
        custom_carousel: []
    });


    // Product Offer Form State
    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
    
    const handleToggleHasDelivery = (checked: boolean) => {
        setCfgHasDelivery(checked);
        if (checked) {
            if (!cfgRoles.includes('delivery')) {
                setCfgRoles(prev => [...prev, 'delivery']);
            }
        } else {
            setCfgRoles(prev => prev.filter(r => r !== 'delivery'));
        }
    };

    const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `profile_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) {
            console.error('Error uploading profile pic:', uploadError);
            alert('Error al subir la foto de perfil');
            return;
        }
        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setCfgProfilePictureUrl(data.publicUrl);
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `banner_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) {
            console.error('Error uploading banner:', uploadError);
            alert('Error al subir el banner');
            return;
        }
        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setCfgBannerUrl(data.publicUrl);
    };

    const handleLandingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `landing_hero_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) {
            console.error('Error uploading landing image:', uploadError);
            alert('Error al subir la imagen');
            return;
        }
        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setCfgLandingConfig({ ...cfgLandingConfig, hero_image_url: data.publicUrl });
    };

    const handleCarouselImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `carousel_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) {
            console.error('Error uploading carousel image:', uploadError);
            alert('Error al subir la imagen del carrusel');
            return;
        }
        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        
        const newCarousel = [...(cfgLandingConfig.custom_carousel || [])];
        newCarousel[index].image_url = data.publicUrl;
        setCfgLandingConfig({ ...cfgLandingConfig, custom_carousel: newCarousel });
    };

    const handleAddCarouselSlide = () => {
        const current = cfgLandingConfig.custom_carousel || [];
        if (current.length >= 10) {
            alert('Límite máximo de 10 diapositivas alcanzado.');
            return;
        }
        const newSlide = {
            id: Date.now().toString(),
            image_url: '',
            title: 'Nuevo Título',
            description: 'Descripción breve para atraer a tus clientes...',
            badge_text: ''
        };
        setCfgLandingConfig({ ...cfgLandingConfig, custom_carousel: [...current, newSlide] });
    };

    const handleRemoveCarouselSlide = (id: string) => {
        const current = cfgLandingConfig.custom_carousel || [];
        setCfgLandingConfig({ ...cfgLandingConfig, custom_carousel: current.filter((s: any) => s.id !== id) });
    };

    const handleUpdateCarouselSlide = (index: number, field: string, value: string) => {
        const current = [...(cfgLandingConfig.custom_carousel || [])];
        current[index] = { ...current[index], [field]: value };
        setCfgLandingConfig({ ...cfgLandingConfig, custom_carousel: current });
    };

    const handleCategoryIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `cat_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) {
            console.error('Error uploading category image:', uploadError);
            alert('Error al subir la imagen de la categoría');
            return;
        }
        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setCatImageUrl(data.publicUrl);
    };

    const [offDiscount, setOffDiscount] = useState('20');
    const [offStartDate, setOffStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [offEndDate, setOffEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [offLimitQty, setOffLimitQty] = useState('');
    const [offSelectedProducts, setOffSelectedProducts] = useState<string[]>([]);
    const [isSavingOffer, setIsSavingOffer] = useState(false);
    const [configError, setConfigError] = useState('');

    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [bulkPercent, setBulkPercent] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // Reservas y Códigos de Descuento
    const [discountCodes, setDiscountCodes] = useState<any[]>([]);
    const [activeReservations, setActiveReservations] = useState<any[]>([]);
    const [isResDataLoading, setIsResDataLoading] = useState(false);
    const [newCodeName, setNewCodeName] = useState('');
    const [newCodeAmount, setNewCodeAmount] = useState('');
    const [newCodeDesc, setNewCodeDesc] = useState('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    // Validación en caja admin
    const [adminManualCode, setAdminManualCode] = useState('');
    const [adminManualDiscount, setAdminManualDiscount] = useState<number>(0);
    const [isAdminValidatingCode, setIsAdminValidatingCode] = useState(false);

    const fetchReservationsAndCodes = async () => {
        if (!tenant) return;
        setIsResDataLoading(true);
        try {
            const [resData, codesData] = await Promise.all([
                supabase.from('reservations').select('*').eq('tenant_id', tenant.id).order('reservation_date', { ascending: false }),
                supabase.from('discount_codes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
            ]);
            if (resData.data) setActiveReservations(resData.data);
            if (codesData.data) setDiscountCodes(codesData.data);
        } catch (err) {
            console.error("Error fetching reservations/codes:", err);
        } finally {
            setIsResDataLoading(false);
        }
    };

    useEffect(() => {
        if (tenant && (!isInitializedRef.current || isInitializedRef.current !== tenant.id)) {
            setCfgName(tenant.name || '');
            setCfgPrimary(tenant.theme_colors?.primary || '#f97316');
            setCfgSecondary(tenant.theme_colors?.secondary || '#1e293b');
            setCfgMode(tenant.theme_colors?.mode || 'dark');
            setCfgRoles(
                tenant.enabled_roles 
                    ? tenant.enabled_roles.filter((r: string) => r !== 'admin') 
                    : ['staff', 'kitchen', 'delivery', 'bartender']
            );
            setCfgStaffPassword(tenant.staff_password === 'redacted' ? '' : (tenant.staff_password || ''));
            setCfgKitchenPassword(tenant.kitchen_password === 'redacted' ? '' : (tenant.kitchen_password || ''));
            setCfgDeliveryPassword(tenant.delivery_password === 'redacted' ? '' : (tenant.delivery_password || ''));
            setCfgBartenderPassword(tenant.bartender_password === 'redacted' ? '' : (tenant.bartender_password || ''));
            setCfgWaiterPassword(tenant.waiter_password === 'redacted' ? '' : (tenant.waiter_password || ''));
            setCfgHasDelivery(tenant.has_delivery || false);
            setCfgDeliveryDays(tenant.delivery_days || [0,1,2,3,4,5,6]);
            setCfgMercadopagoPublicKey(tenant.mercadopago_public_key || '');
            setCfgMercadopagoAccessToken(tenant.mercadopago_access_token === 'redacted' ? '' : (tenant.mercadopago_access_token || ''));
            setCfgDeliveryZones(Array.isArray(tenant.delivery_zones) ? tenant.delivery_zones : []);
            setCfgProfilePictureUrl((tenant as any).profile_picture_url || '');
            setCfgBannerUrl((tenant as any).banner_url || '');
            setCfgDescription((tenant as any).description || '');
            const links = (tenant as any).social_links || {};
            setCfgInstagram(links.instagram || '');
            setCfgFacebook(links.facebook || '');
            setCfgWhatsapp(links.whatsapp || '');
            setCfgAddress(links.address || '');
            setCfgGoogleMapsUrl(links.google_maps_url || '');
            setCfgMapsIframe(links.maps_iframe || '');
            setCfgReviewsEnabled((tenant as any).reviews_enabled !== false);
            setCfgReservationsEnabled((tenant as any).reservations_enabled === true);
            setCfgReservationDepositAmount((tenant as any).reservation_deposit_amount || 0);
            setCfgTipsEnabled((tenant as any).tips_enabled || false);
            setCfgTableChargeEnabled((tenant as any).table_charge_enabled || false);
            setCfgTableChargeAmount((tenant as any).table_charge_amount || 0);
            setTablesList(tenant.tables || []);
            
            // Cargar datos de AFIP
            setCfgAfipEnabled((tenant as any).afip_enabled || false);
            setCfgAfipCuit((tenant as any).afip_cuit || '');
            setCfgAfipPuntoVenta(String((tenant as any).afip_punto_venta || '1'));
            setCfgAfipCondicionIva((tenant as any).afip_condicion_iva || 'Monotributista');
            setCfgAfipIsSandbox((tenant as any).afip_is_sandbox !== false);
            setCfgAfipCertPath((tenant as any).afip_cert_path || '');
            setCfgAfipKeyPath((tenant as any).afip_key_path || '');

            // Cargar configuraciones de Delivery Apps
            setCfgDeliveryAppsEnabled((tenant as any).delivery_apps_enabled || false);
            setCfgRappiStoreId((tenant as any).rappi_store_id || '');
            setCfgPedidosyaStoreId((tenant as any).pedidosya_store_id || '');
            setCfgDeliveryAppsToken((tenant as any).delivery_apps_token || '');
            setCfgDeliveryAppsMarkup((tenant as any).delivery_apps_markup || 0);
            setCfgDeliveryAppsPanicActive((tenant as any).is_delivery_apps_panic_active || false);
            if ((tenant as any).delivery_apps_schedule) {
                setCfgDeliveryAppsSchedule((tenant as any).delivery_apps_schedule);
            }

            // Cargar configuración de Landing Page
            if ((tenant as any).landing_config) {
                setCfgLandingConfig({
                    enabled: (tenant as any).landing_config.enabled || false,
                    hero_style: (tenant as any).landing_config.hero_style || 'modern',
                    interactive_wall_enabled: (tenant as any).landing_config.interactive_wall_enabled || false,
                    hero_video_url: (tenant as any).landing_config.hero_video_url || '',
                    hero_image_url: (tenant as any).landing_config.hero_image_url || '',
                    promos: (tenant as any).landing_config.promos || [],
                    events: (tenant as any).landing_config.events || [],
                    custom_carousel: (tenant as any).landing_config.custom_carousel || []
                });
            }

            // Cargar Business Hours & Delivery Hours
            if ((tenant as any).business_hours) {
                setCfgBusinessHours((tenant as any).business_hours);
            } else {
                setCfgBusinessHours({ enabled: false, schedule: JSON.parse(JSON.stringify(defaultSchedule)) });
            }
            if ((tenant as any).delivery_hours) {
                setCfgDeliveryHours((tenant as any).delivery_hours);
            } else {
                setCfgDeliveryHours({ enabled: false, schedule: JSON.parse(JSON.stringify(defaultSchedule)) });
            }
            if ((tenant as any).reservation_hours) {
                setCfgReservationHours((tenant as any).reservation_hours);
            } else {
                setCfgReservationHours({ enabled: false, schedule: JSON.parse(JSON.stringify(defaultSchedule)) });
            }
            setCfgDeliveryPanic((tenant as any).delivery_panic_button || false);

            // Cargar configuraciones de Fidelización (Micro-CRM)
            setLoyConfigEnabled((tenant as any).loyalty_enabled !== false);
            if ((tenant as any).loyalty_config) {
                const cfg = (tenant as any).loyalty_config;
                setLoyConfigEarnChan(cfg.earn_channel || 'both');
                setLoyConfigRedeemChan(cfg.redeem_channel || 'both');
                setLoyConfigCashbackPct(cfg.cashback_pct || 5);
                if (Array.isArray(cfg.tiers)) {
                    setLoyConfigTiers(cfg.tiers);
                }
            }
            
            isInitializedRef.current = tenant.id;
            fetchReservationsAndCodes();
        }
    }, [tenant]);

    const fetchLoyaltyAccounts = async () => {
        if (!tenant?.id) return;
        setIsFetchingLoyalty(true);
        try {
            const { data, error } = await supabase
                .from('loyalty_accounts')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('total_spent', { ascending: false });

            if (error) throw error;
            setLoyaltyAccounts(data || []);
        } catch (err) {
            console.error('Error fetching loyalty accounts:', err);
        } finally {
            setIsFetchingLoyalty(false);
        }
    };

    const handleUpdateLoyaltyConfig = async () => {
        if (!tenant?.id) return;
        setIsSavingLoyaltyConfig(true);
        try {
            const config = {
                earn_channel: loyConfigEarnChan,
                redeem_channel: loyConfigRedeemChan,
                cashback_pct: parseFloat(String(loyConfigCashbackPct)) || 5,
                tiers: loyConfigTiers
            };

            const { error } = await supabase
                .from('tenants')
                .update({
                    loyalty_enabled: loyConfigEnabled,
                    loyalty_config: config
                })
                .eq('id', tenant.id);

            if (error) throw error;
            alert("✅ Configuración del Club de Clientes guardada con éxito.");
            if (refetchData) refetchData();
        } catch (err: any) {
            console.error("Error al guardar config de fidelización:", err);
            alert("Error al guardar: " + err.message);
        } finally {
            setIsSavingLoyaltyConfig(false);
        }
    };

    const handleAdjustBalanceManual = async (accountId: string, finalBalance: number) => {
        try {
            const { error } = await supabase
                .from('loyalty_accounts')
                .update({ balance: finalBalance })
                .eq('id', accountId);

            if (error) throw error;
            alert("✅ Saldo de cliente actualizado correctamente.");
            setEditingLoyaltyAccount(null);
            setNewBalance('');
            fetchLoyaltyAccounts();
        } catch (err: any) {
            console.error("Error al ajustar saldo:", err);
            alert("Error al ajustar: " + err.message);
        }
    };

    useEffect(() => {
        if (view === 'loyalty') {
            fetchLoyaltyAccounts();
        }
    }, [view, tenant?.id]);

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant || !newCodeName || !newCodeAmount) return;
        setIsGeneratingCode(true);
        try {
            const codeToInsert = newCodeName.toUpperCase().replace(/\s+/g, '');
            const amountToInsert = parseFloat(newCodeAmount);
            if (isNaN(amountToInsert) || amountToInsert <= 0) {
                alert("⚠️ Monto inválido");
                return;
            }
            const { data, error } = await supabase.from('discount_codes').insert({
                tenant_id: tenant.id,
                code: codeToInsert,
                discount_amount: amountToInsert,
                description: newCodeDesc
            }).select().single();

            if (error) {
                if (error.code === '23505') {
                    alert("⚠️ Este código ya existe. Por favor elige otro nombre.");
                } else {
                    alert("⚠️ Error al crear el código: " + error.message);
                }
            } else if (data) {
                setDiscountCodes(prev => [data, ...prev]);
                setNewCodeName('');
                setNewCodeAmount('');
                setNewCodeDesc('');
                alert("✅ Código creado con éxito.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const handleValidateAdminCode = async () => {
        if (!tenant || !adminManualCode) return;
        setIsAdminValidatingCode(true);
        try {
            let codeToSearch = adminManualCode.toUpperCase().trim();
            if (codeToSearch.length === 4 && !codeToSearch.startsWith('RES-')) {
                codeToSearch = 'RES-' + codeToSearch;
            }
            // Primero buscar en reservations
            const { data: resData } = await supabase.from('reservations')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('reservation_code', codeToSearch)
                .maybeSingle();
            
            if (resData && !resData.is_deposit_applied) {
                setAdminManualDiscount(resData.deposit_amount || 0);
                alert(`✅ Reserva encontrada. Seña a descontar: $${resData.deposit_amount || 0}`);
            } else if (resData && resData.is_deposit_applied) {
                alert("⚠️ La seña de esta reserva ya fue aplicada anteriormente.");
            } else {
                // Si no es reserva, buscar en discount_codes
                const { data: codeData } = await supabase.from('discount_codes')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .eq('code', codeToSearch)
                    .maybeSingle();
                
                if (codeData && !codeData.is_used) {
                    setAdminManualDiscount(codeData.discount_amount || 0);
                    alert(`✅ Código de descuento encontrado. Descuento: $${codeData.discount_amount || 0}`);
                } else if (codeData && codeData.is_used) {
                    alert("⚠️ Este código ya fue utilizado.");
                } else {
                    alert("⚠️ Código inválido o no encontrado.");
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsAdminValidatingCode(false);
        }
    };

    const handleSaveOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant) return;
        if (offSelectedProducts.length === 0) {
            alert("⚠️ Debes seleccionar al menos un producto para la oferta.");
            return;
        }
        const disc = parseFloat(offDiscount);
        if (isNaN(disc) || disc <= 0 || disc > 100) {
            alert("⚠️ El porcentaje de descuento debe estar entre 1 y 100.");
            return;
        }
        if (!offStartDate || !offEndDate) {
            alert("⚠️ Debes ingresar las fechas de validez de la oferta.");
            return;
        }
        if (new Date(offStartDate) > new Date(offEndDate)) {
            alert("⚠️ La fecha de inicio no puede ser posterior a la fecha de finalización.");
            return;
        }

        setIsSavingOffer(true);
        try {
            // Verificar si ya existe una categoría de ofertas o una marcada como oferta
            const hasOfferCategory = (categories || []).some(cat => 
                cat.is_offer === true || 
                cat.name.toLowerCase().includes('oferta') || 
                cat.name.toLowerCase().includes('descuento') || 
                cat.name.toLowerCase().includes('oportunidad')
            );

            if (!hasOfferCategory) {
                console.log("[OFERTA AUTO-CATEGORIA] No se encontró categoría de ofertas. Creando una automáticamente...");
                const { error: catError } = await supabase.from('categories').insert([{
                    name: 'Ofertas Especiales',
                    icon: '🏷️',
                    is_offer: true,
                    target_departments: ['kitchen'],
                    tenant_id: tenant.id
                }]);
                
                if (catError) {
                    console.error("Error al auto-crear la categoría de ofertas:", catError);
                }
            }

            // Mapear cada producto seleccionado a una fila independiente en la base de datos
            const offersToInsert = offSelectedProducts.map(productId => ({
                discount_percentage: disc,
                start_date: offStartDate,
                end_date: offEndDate,
                limit_quantity: offLimitQty ? parseFloat(offLimitQty) : null,
                product_ids: [productId], // Se guarda como un array con un único elemento para independizarlo
                tenant_id: tenant.id
            }));

            const { error } = await supabase.from('product_offers').insert(offersToInsert);

            setIsSavingOffer(false);
            if (error) {
                console.error("Error al guardar las ofertas:", error);
                alert("Error al crear la oferta: " + error.message);
            } else {
                alert("🎉 ¡Ofertas individuales creadas exitosamente para cada producto en tiempo real!");
                setIsOfferModalOpen(false);
                setOffSelectedProducts([]);
                setOffDiscount('20');
                setOffLimitQty('');
                refetchData?.();
            }
        } catch (err: any) {
            setIsSavingOffer(false);
            alert("Error al procesar la oferta: " + err.message);
        }
    };

    const handleDeleteOffer = async (offerId: string) => {
        if (!window.confirm("⚠️ ¿Estás seguro de que deseas eliminar esta oferta?")) return;
        const { error } = await supabase.from('product_offers').delete().eq('id', offerId);
        if (error) {
            console.error("Error al eliminar la oferta:", error);
            alert("Error al eliminar la oferta: " + error.message);
        } else {
            alert("✅ Oferta eliminada con éxito");
            refetchData?.();
        }
    };

    const handleBulkPriceUpdate = async () => {
        const percentVal = parseFloat(bulkPercent);
        if (isNaN(percentVal) || percentVal === 0) {
            alert("⚠️ Por favor ingresa un porcentaje de aumento válido.");
            return;
        }

        const count = selectedProductIds.length;
        const confirmMsg = `¿Estás seguro de que deseas aplicar un aumento del ${percentVal}% en lote a los ${count} productos seleccionados?\n\nLos precios serán redondeados al entero más cercano.`;
        
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsBulkUpdating(true);
        try {
            // Actualizar individualmente cada producto seleccionado en Supabase
            let successCount = 0;
            let errorOccurred = false;

            for (const productId of selectedProductIds) {
                const prod = products.find(p => p.id === productId);
                if (!prod) continue;

                const newPrice = Math.round(prod.price * (1 + (percentVal / 100)));
                
                const { error } = await supabase
                    .from('products')
                    .update({ price: newPrice })
                    .eq('id', productId);

                if (error) {
                    console.error(`Error al actualizar precio de ${prod.name}:`, error);
                    errorOccurred = true;
                } else {
                    successCount++;
                }
            }

            setIsBulkUpdating(false);
            if (errorOccurred) {
                alert(`⚠️ Se completó con algunos errores. Se actualizaron ${successCount} de ${count} productos.`);
            } else {
                alert(`🎉 ¡Actualización en lote completada con éxito! Se aplicó un aumento del ${percentVal}% a los ${successCount} productos.`);
            }

            // Limpiar estados y refrescar datos
            setSelectedProductIds([]);
            setBulkPercent('');
            refetchData?.();
        } catch (err: any) {
            setIsBulkUpdating(false);
            alert("⚠️ Ocurrió un error inesperado al actualizar los precios: " + err.message);
        }
    };

    const handleRemoveProductFromOffer = async (productId: string, offer: ProductOffer) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas dar de baja este producto de la oferta del ${offer.discount_percentage}% OFF?`)) return;
        
        const pIds = getProductIdsArray(offer.product_ids);
        
        if (pIds.length <= 1) {
            const { error } = await supabase.from('product_offers').delete().eq('id', offer.id);
            if (error) {
                console.error("Error al dar de baja el producto de la oferta:", error);
                alert("Error al dar de baja de oferta: " + error.message);
            } else {
                alert("✅ Oferta removida con éxito");
                refetchData?.();
            }
        } else {
            const updatedProductIds = pIds.filter(id => id !== productId);
            const { error } = await supabase.from('product_offers')
                .update({ product_ids: updatedProductIds })
                .eq('id', offer.id);
            
            if (error) {
                console.error("Error al remover el producto de la oferta:", error);
                alert("Error al remover producto de oferta: " + error.message);
            } else {
                alert("✅ El producto fue removido de la oferta con éxito");
                refetchData?.();
            }
        }
    };

    const handleDeleteProduct = async (prod: Product) => {
        if (!window.confirm(`⚠️ ¿Deseas eliminar permanentemente el producto "${prod.name}"?`)) return;
        
        const { error } = await supabase.from('products').delete().eq('id', prod.id);
        
        if (error) {
            console.error("Error al eliminar producto:", error);
            // Código 23503 indica violación de clave foránea
            if (error.code === '23503') {
                const confirmSoftDelete = window.confirm(
                    `Este producto tiene historial de ventas y no se puede borrar físicamente.\n\n¿Deseas desactivarlo para que no aparezca en el menú?`
                );
                if (confirmSoftDelete) {
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({ is_active: false })
                        .eq('id', prod.id);
                    
                    if (updateError) {
                        console.error("Error al desactivar el producto:", updateError);
                        alert("Error al desactivar el producto: " + updateError.message);
                    } else {
                        alert("✅ Producto desactivado exitosamente.");
                        refetchData?.();
                    }
                }
            } else {
                alert("Error al eliminar el producto: " + error.message);
            }
        } else {
            alert("✅ Producto eliminado físicamente con éxito.");
            refetchData?.();
        }
    };

    const handleActivateProduct = async (prod: Product) => {
        const { error } = await supabase
            .from('products')
            .update({ is_active: true })
            .eq('id', prod.id);
        
        if (error) {
            console.error("Error al activar el producto:", error);
            alert("Error al activar el producto: " + error.message);
        } else {
            alert("✅ Producto activado exitosamente.");
            refetchData?.();
        }
    };
    const handleAfipCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !tenant) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `cert_${tenant.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filePath', filePath);

        setIsUploadingCert(true);
        try {
            const res = await fetch('/api/afip/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Error desconocido');
            }
            
            setCfgAfipCertPath(result.path || filePath);
        } catch (err: any) {
            console.error('Error uploading cert:', err);
            alert('Error al subir el certificado CRT: ' + err.message);
        } finally {
            setIsUploadingCert(false);
        }
    };

    const handleAfipKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !tenant) return;
        const fileExt = file.name.split('.').pop();
        const fileName = `key_${tenant.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filePath', filePath);

        setIsUploadingKey(true);
        try {
            const res = await fetch('/api/afip/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Error desconocido');
            }
            
            setCfgAfipKeyPath(result.path || filePath);
        } catch (err: any) {
            console.error('Error uploading key:', err);
            alert('Error al subir la clave privada KEY: ' + err.message);
        } finally {
            setIsUploadingKey(false);
        }
    };

    const handleSaveAfipConfig = async () => {
        if (!tenant || !onTenantUpdate) return;
        setIsSavingAfip(true);
        try {
            const { data, error } = await supabase
                .from('tenants')
                .update({
                    afip_enabled: cfgAfipEnabled,
                    afip_cuit: cfgAfipCuit,
                    afip_punto_venta: parseInt(cfgAfipPuntoVenta) || 1,
                    afip_condicion_iva: cfgAfipCondicionIva,
                    afip_is_sandbox: cfgAfipIsSandbox,
                    afip_cert_path: cfgAfipCertPath,
                    afip_key_path: cfgAfipKeyPath
                })
                .eq('id', tenant.id)
                .select()
                .single();

            if (error) throw error;
            onTenantUpdate(data);
            alert('✅ ¡Configuración Fiscal guardada con éxito!');
        } catch (err: any) {
            console.error('Error saving AFIP config:', err);
            alert('Error al guardar la configuración fiscal: ' + err.message);
        } finally {
            setIsSavingAfip(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!tenant || !onTenantUpdate) return;
        setIsSavingConfig(true);
        setConfigSuccess(false);
        setConfigError('');

        // Las validaciones de contraseñas de roles antiguos han sido movidas a la pestaña Personal.

        try {
            const updatedColors = {
                primary: cfgPrimary,
                secondary: cfgSecondary,
                mode: cfgMode
            };
            const updatedRoles = ['admin', ...cfgRoles];

            let data = null;
            let error = null;

            // Generar nuevo slug a partir del nombre
            const newSlug = cfgName
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
                .replace(/[^a-z0-9]+/g, '-') // espacios y otros a guiones
                .replace(/(^-|-$)/g, ''); // quitar guiones a los lados

            try {
                // 1. INTENTO PREMIUM: Con todas las columnas extendidas
                const links = {
                    instagram: cfgInstagram,
                    facebook: cfgFacebook,
                    whatsapp: cfgWhatsapp,
                    address: cfgAddress,
                    google_maps_url: cfgGoogleMapsUrl,
                    maps_iframe: cfgMapsIframe
                };
                const result = await supabase
                    .from('tenants')
                    .update({
                        name: cfgName,
                        slug: newSlug,
                        theme_colors: updatedColors,
                        enabled_roles: updatedRoles,
                        has_delivery: cfgHasDelivery,
                        delivery_days: cfgDeliveryDays,
                        mercadopago_public_key: cfgMercadopagoPublicKey,
                        delivery_zones: cfgDeliveryZones,
                        profile_picture_url: cfgProfilePictureUrl,
                        banner_url: cfgBannerUrl,
                        description: cfgDescription,
                        social_links: links,
                        reviews_enabled: cfgReviewsEnabled,
                        reservations_enabled: cfgReservationsEnabled,
                        reservation_deposit_amount: cfgReservationDepositAmount,
                        tips_enabled: cfgTipsEnabled,
                        table_charge_enabled: cfgTableChargeEnabled,
                        table_charge_amount: cfgTableChargeAmount,
                        delivery_apps_enabled: cfgDeliveryAppsEnabled,
                        rappi_store_id: cfgRappiStoreId,
                        pedidosya_store_id: cfgPedidosyaStoreId,
                        delivery_apps_token: cfgDeliveryAppsToken,
                        delivery_apps_markup: cfgDeliveryAppsMarkup,
                        is_delivery_apps_panic_active: cfgDeliveryAppsPanicActive,
                        delivery_apps_schedule: cfgDeliveryAppsSchedule,
                        business_hours: cfgBusinessHours,
                        delivery_hours: cfgDeliveryHours,
                        reservation_hours: cfgReservationHours,
                        delivery_panic_button: cfgDeliveryPanic,
                        landing_config: cfgLandingConfig
                    })
                    .eq('id', tenant.id)
                    .select()
                    .single();
                
                data = result.data;
                error = result.error;

                // Si da error de columna no encontrada (código 42703 o mensaje de schema cache / column)
                if (error && (error.message?.includes('column') || error.message?.includes('schema cache') || error.code === '42703')) {
                    console.warn("⚠️ Columnas extendidas no encontradas en 'tenants'. Ejecutando fallback defensivo básico...", error);
                    
                    // 2. FALLBACK DEFENSIVO BÁSICO: Guardar sólo las columnas tradicionales + descripción si está disponible
                    const fallbackResult = await supabase
                        .from('tenants')
                        .update({
                            name: cfgName,
                            slug: newSlug,
                            theme_colors: updatedColors,
                            enabled_roles: updatedRoles,
                            description: cfgDescription,
                            delivery_days: cfgDeliveryDays
                        })
                        .eq('id', tenant.id)
                        .select()
                        .single();

                    data = fallbackResult.data;
                    error = fallbackResult.error;

                    if (!error && data) {
                        alert("⚠️ AJUSTES GUARDADOS EN MODO COMPATIBILIDAD BÁSICA:\n\nSe guardaron los roles, contraseñas y descripción con éxito. Sin embargo, no se pudieron guardar los ajustes de Mercado Pago, Envíos a Domicilio ni Reservas porque las columnas correspondientes no existen o no están cacheadas en tu base de datos de Supabase.\n\nPara habilitar las funciones premium, por favor asegúrate de ejecutar el script de migración SQL en el SQL Editor de tu panel de Supabase.");
                    }
                }
            } catch (err: any) {
                console.error("Excepción en guardado premium, reintentando básico...", err);
                // 3. SEGUNDO FALLBACK DEFENSIVO ANTE EXCEPCIÓN
                const fallbackResult = await supabase
                    .from('tenants')
                    .update({
                        name: cfgName,
                        slug: newSlug,
                        theme_colors: updatedColors,
                        enabled_roles: updatedRoles,
                        delivery_days: cfgDeliveryDays
                    })
                    .eq('id', tenant.id)
                    .select()
                    .single();

                data = fallbackResult.data;
                error = fallbackResult.error;
            }

            if (error) {
                console.error('Error saving config:', error);
                
                // Mostrar error amigable si el nombre/slug ya existe (restricción UNIQUE)
                if (error.code === '23505' || error.message?.includes('duplicate key value')) {
                    setConfigError('Ese nombre de local ya está registrado o en uso. Por favor, elige otro ligeramente distinto.');
                } else {
                    setConfigError('No se pudo guardar la configuración: ' + error.message);
                }
            } else if (data) {
                setConfigSuccess(true);
                isInitializedRef.current = data.id;
                
                // Actualizar secretos (Contraseñas y Token de MercadoPago)
                try {
                    const { error: secretsError } = await supabase.rpc('update_tenant_secrets', {
                        p_admin_password: null, 
                        p_staff_password: cfgStaffPassword,
                        p_kitchen_password: cfgKitchenPassword,
                        p_delivery_password: cfgDeliveryPassword,
                        p_bartender_password: cfgBartenderPassword,
                        p_waiter_password: cfgWaiterPassword,
                        p_mercadopago_token: cfgMercadopagoAccessToken
                    });
                    
                    if (secretsError) {
                        console.error("Error guardando contraseñas seguras:", secretsError);
                    }
                } catch (e) {
                    console.error("No se pudo ejecutar update_tenant_secrets:", e);
                }

                onTenantUpdate(data);
                
                if (data.slug && data.slug !== tenant.slug) {
                    alert('El nombre y el enlace de tu local han cambiado. Serás redirigido a la nueva dirección web.');
                    window.location.href = '/' + data.slug;
                    return;
                }
                
                setTimeout(() => setConfigSuccess(false), 3000);
            }
        } catch (err) {
            setConfigError('Hubo un error de conexión.');
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleSaveTablesList = async (newTables: { id: string; name: string }[]) => {
        if (!tenant || !onTenantUpdate) return;
        setIsSavingTables(true);
        try {
            const { data, error } = await supabase
                .from('tenants')
                .update({
                    tables: newTables
                })
                .eq('id', tenant.id)
                .select()
                .single();

            if (error) {
                console.error('Error saving tables:', error);
                alert('No se pudo guardar la lista de mesas: ' + error.message);
            } else {
                onTenantUpdate(data);
                setTablesList(data.tables || []);
            }
        } catch (err) {
            console.error('Error en handleSaveTablesList:', err);
            alert('Error de conexión al guardar las mesas.');
        } finally {
            setIsSavingTables(false);
        }
    };

    const handleAddTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTableName.trim()) return;

        const newTable = {
            id: 't_' + Date.now(),
            name: newTableName.trim(),
            capacity: newTableCapacity,
            is_occupied: false
        };
        const updated = [...tablesList, newTable];
        await handleSaveTablesList(updated);
        setNewTableName('');
        setNewTableCapacity(4);
    };

    const handleDeleteTable = async (tableId: string) => {
        const confirmDelete = window.confirm('¿Estás seguro de que deseas eliminar esta mesa? Los códigos QR asociados dejarán de ser válidos.');
        if (!confirmDelete) return;

        const updated = tablesList.filter(t => t.id !== tableId);
        await handleSaveTablesList(updated);
    };

    const handleDeleteWaiter = async (waiterId: string) => {
        if (!tenant?.id) return;
        
        const currentWaiters = Array.isArray(tenant.waiters) ? [...tenant.waiters] : [];
        const waiterToDelete = currentWaiters.find((w: any) => w.id === waiterId);
        if (!waiterToDelete) return;

        if (!window.confirm(`¿Estás seguro de que deseas eliminar al mozo "${waiterToDelete.name}"? Esto liberará todas sus mesas asignadas.`)) {
            return;
        }

        const updatedWaiters = currentWaiters.filter((w: any) => w.id !== waiterId);

        const currentTables = Array.isArray(tenant.tables) ? [...tenant.tables] : [];
        const updatedTables = currentTables.map((table: any) => {
            if (table.waiter_name && table.waiter_name.toLowerCase().trim() === waiterToDelete.name.toLowerCase().trim()) {
                return { ...table, waiter_name: null };
            }
            return table;
        });

        try {
            const { data, error } = await supabase
                .from('tenants')
                .update({ 
                    waiters: updatedWaiters,
                    tables: updatedTables
                })
                .eq('id', tenant.id)
                .select()
                .single();

            if (!error && data) {
                if (onTenantUpdate) {
                    onTenantUpdate(data);
                }
                broadcastTenantChange(tenant.id);
                alert(`Mozo "${waiterToDelete.name}" eliminado correctamente y sus mesas fueron liberadas.`);
            } else {
                console.error("Error al eliminar mozo:", error);
                alert("Error al guardar cambios en Supabase.");
            }
        } catch (err) {
            console.error("Excepción al eliminar mozo:", err);
            alert("Error de conexión al eliminar el mozo.");
        }
    };

    const filteredOrders = useMemo(() => {
        const now = new Date();
        
        // Obtener el inicio del día calendario de "Hoy" local (00:00:00.000)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        // Obtener el final del día calendario de "Hoy" local (23:59:59.999)
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

        // Para la semana, definimos los últimos 7 días calendario local (incluyendo hoy)
        const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;

        return orders.filter(o => {
            // Ya NO descartamos si está archivado. ¡Queremos ver las ventas reales cobradas!
            const oDate = new Date(o.created_at).getTime();
            
            if (salesPeriod === 'daily') {
                return oDate >= startOfToday && oDate <= endOfToday;
            }
            if (salesPeriod === 'weekly') {
                return oDate >= startOfWeek && oDate <= endOfToday;
            }
            return true;
        });
    }, [orders, salesPeriod]);

    const dailyStats = useMemo(() => {
        let total = 0;
        let efectivo = 0;
        let debito = 0;
        let credito = 0;
        let rappi = 0;
        let pedidosya = 0;

        filteredOrders.forEach(o => {
            const rev = getOrderRevenue(o);
            const seña = (o as any).coupon_code && (o as any).coupon_code.startsWith('RES-') ? ((o as any).discount_amount || 0) : 0;
            
            total += rev;
            if (o.payment_method === 'rappi' || o.origin === 'rappi') {
                rappi += rev;
            } else if (o.payment_method === 'pedidosya' || o.origin === 'pedidosya') {
                pedidosya += rev;
            } else if (o.payment_method === 'efectivo') {
                efectivo += o.total_price;
                debito += seña;
            } else if (o.payment_method === 'debito') {
                debito += rev;
            } else if (o.payment_method === 'credito') {
                credito += rev;
            } else {
                // Retrocompatibilidad con pedidos de caja antiguos que se guardaron como 'mercadopago'
                const valDebito = Math.round(o.total_price * 0.6) + seña;
                debito += valDebito;
                credito += (o.total_price - (valDebito - seña)); // Residual
            }
        });

        // Subtract today's expenses from daily balance
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        expenses.forEach(e => {
            const eDate = new Date(e.date || new Date());
            if (eDate >= startOfToday && eDate <= endOfToday) {
                total -= e.amount;
                // Assuming all expenses are paid in cash (efectivo)
                efectivo -= e.amount;
            }
        });

        return { total, efectivo, debito, credito, rappi, pedidosya };
    }, [filteredOrders, expenses]);

    const yearlyOrders = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return orders.filter(o => {
            if (!o.is_archived) return false;
            const oDate = new Date(o.created_at);
            return oDate.getFullYear() === currentYear;
        });
    }, [orders]);

    const yearlyTotal = useMemo(() => {
        return yearlyOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);
    }, [yearlyOrders]);

    const ordersGroupedByMonthAndDay = useMemo(() => {
        const grouped: Record<string, Record<string, Order[]>> = {};
        
        yearlyOrders.forEach(o => {
            const date = new Date(o.created_at);
            const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
            const monthKey = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${day}`;
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = {};
            }
            if (!grouped[monthKey][dayKey]) {
                grouped[monthKey][dayKey] = [];
            }
            grouped[monthKey][dayKey].push(o);
        });
        
        return grouped;
    }, [yearlyOrders]);

    const sortedMonthEntries = useMemo(() => {
        const entries = Object.entries(ordersGroupedByMonthAndDay);
        if (yearlySortOption === 'chrono') {
            const monthOrder = [
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            ];
            return entries.sort((a, b) => monthOrder.indexOf(a[0]) - monthOrder.indexOf(b[0]));
        }
        
        const getMonthTotal = (days: Record<string, Order[]>) => {
            return Object.values(days).flat().reduce((sum, o) => sum + getOrderRevenue(o), 0);
        };
        
        return entries.sort((a, b) => {
            const totalA = getMonthTotal(a[1]);
            const totalB = getMonthTotal(b[1]);
            if (yearlySortOption === 'highest') {
                return totalB - totalA;
            } else {
                return totalA - totalB;
            }
        });
    }, [ordersGroupedByMonthAndDay, yearlySortOption]);

    const currentMonthOrders = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        return orders.filter(o => {
            const oDate = new Date(o.created_at);
            return oDate.getFullYear() === currentYear && oDate.getMonth() === currentMonth;
        });
    }, [orders]);

    const getWeekOfMonth = (date: Date): number => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        let dayOfWeek = firstDay.getDay() - 1; // Lunes = 0, ..., Domingo = 6
        if (dayOfWeek < 0) dayOfWeek = 6;
        
        const offset = dayOfWeek;
        const dayOfMonth = date.getDate();
        return Math.ceil((dayOfMonth + offset) / 7);
    };

    const weeklyOrdersGrouped = useMemo(() => {
        const grouped: Record<number, Order[]> = {};
        currentMonthOrders.forEach(o => {
            const date = new Date(o.created_at);
            const weekNum = getWeekOfMonth(date);
            if (!grouped[weekNum]) {
                grouped[weekNum] = [];
            }
            grouped[weekNum].push(o);
        });
        return grouped;
    }, [currentMonthOrders]);

    const currentWeekStats = useMemo(() => {
        const now = new Date();
        const currentWeekNum = getWeekOfMonth(now);
        const currentWeekOrdersList = weeklyOrdersGrouped[currentWeekNum] || [];
        
        let total = 0;
        let efectivo = 0;
        let debito = 0;
        let credito = 0;
        let rappi = 0;
        let pedidosya = 0;

        currentWeekOrdersList.forEach(o => {
            const rev = getOrderRevenue(o);
            const seña = (o as any).coupon_code && (o as any).coupon_code.startsWith('RES-') ? ((o as any).discount_amount || 0) : 0;
            
            total += rev;
            if (o.payment_method === 'rappi' || o.origin === 'rappi') {
                rappi += rev;
            } else if (o.payment_method === 'pedidosya' || o.origin === 'pedidosya') {
                pedidosya += rev;
            } else if (o.payment_method === 'efectivo') {
                efectivo += o.total_price;
                debito += seña;
            } else if (o.payment_method === 'debito') {
                debito += rev;
            } else if (o.payment_method === 'credito') {
                credito += rev;
            } else {
                const valDebito = Math.round(o.total_price * 0.6) + seña;
                debito += valDebito;
                credito += (o.total_price - (valDebito - seña));
            }
        });

        return { total, efectivo, debito, credito, rappi, pedidosya, ordersCount: currentWeekOrdersList.length };
    }, [weeklyOrdersGrouped]);

    const selectedDayStats = useMemo(() => {
        if (!selectedDaySales) return { total: 0, efectivo: 0, debito: 0, credito: 0 };
        let total = 0;
        let efectivo = 0;
        let debito = 0;
        let credito = 0;
        let rappi = 0;
        let pedidosya = 0;

        selectedDaySales.orders.forEach(o => {
            const rev = getOrderRevenue(o);
            const seña = (o as any).coupon_code && (o as any).coupon_code.startsWith('RES-') ? ((o as any).discount_amount || 0) : 0;
            
            total += rev;
            if (o.payment_method === 'rappi' || o.origin === 'rappi') {
                rappi += rev;
            } else if (o.payment_method === 'pedidosya' || o.origin === 'pedidosya') {
                pedidosya += rev;
            } else if (o.payment_method === 'efectivo') {
                efectivo += o.total_price;
                debito += seña;
            } else if (o.payment_method === 'debito') {
                debito += rev;
            } else if (o.payment_method === 'credito') {
                credito += rev;
            } else {
                const valDebito = Math.round(o.total_price * 0.6) + seña;
                debito += valDebito;
                credito += (o.total_price - (valDebito - seña));
            }
        });

        return { total, efectivo, debito, credito, rappi, pedidosya };
    }, [selectedDaySales]);

    const bestSellers = useMemo(() => {
        const counts: Record<string, number> = {};
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        orders.forEach(o => {
            const oDate = new Date(o.created_at);
            // Filtrar para sumar únicamente los pedidos del mes calendario actual
            if (oDate.getFullYear() === currentYear && oDate.getMonth() === currentMonth) {
                o.items?.forEach(item => {
                    if (item.product_id) counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
                });
            }
        });
        return Object.entries(counts)
            .map(([id, qty]) => ({ id, qty, name: products.find(p => p.id === id)?.name || 'Desconocido' }))
            .sort((a, b) => b.qty - a.qty);
    }, [orders, products]);

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);

    // Balance Logic
    const monthlyBalance = useMemo(() => {
        const getLocalDateKey = (dateStr: string) => {
            if (!dateStr) return '';
            if (dateStr.includes('T')) {
                const d = new Date(dateStr);
                return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            }
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}`;
            }
            const d = new Date(dateStr);
            return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        };

        const months: Record<string, {
            income: number,
            expense: number,
            transactions: any[],
            productStats: Record<string, number>,
            ingredientStats: Record<string, number>
        }> = {};

        // Pre-popular los últimos 6 meses para asegurar que se muestren en el gráfico (con barra gris si están vacíos)
        const hoy = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            months[key] = {
                income: 0,
                expense: 0,
                transactions: [],
                productStats: {},
                ingredientStats: {}
            };
        }

        orders.forEach(o => {
            const key = getLocalDateKey(o.created_at);
            if (!key) return;
            if (!months[key]) months[key] = { income: 0, expense: 0, transactions: [], productStats: {}, ingredientStats: {} };

            const rev = getOrderRevenue(o);
            months[key].income += rev;
            months[key].transactions.push({ ...o, type: 'income', total_price: rev });

            // Calculate product and ingredient stats for this month
            o.items?.forEach(item => {
                const prod = products.find(p => p.id === item.product_id);
                // Products
                if (item.product_id) months[key].productStats[item.product_id] = (months[key].productStats[item.product_id] || 0) + item.quantity;
                // Ingredients
                if (prod) {
                    const pIngs = productIngredients.filter(pi => pi.product_id === prod.id);
                    pIngs.forEach(ing => {
                        months[key].ingredientStats[ing.ingredient_id] = (months[key].ingredientStats[ing.ingredient_id] || 0) + (ing.quantity_used * item.quantity);
                    });
                }
            });
        });

        expenses.forEach(e => {
            const key = getLocalDateKey(e.date);
            if (!key) return;
            if (!months[key]) months[key] = { income: 0, expense: 0, transactions: [], productStats: {}, ingredientStats: {} };
            months[key].expense += e.amount;
            months[key].transactions.push({ ...e, type: e.type || 'expense' });
        });

        return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
    }, [orders, expenses, products]);

    const chartData = useMemo(() => {
        return monthlyBalance.map(([month, data]) => {
            const [y, m] = month.split('-');
            const localDate = new Date(parseInt(y), parseInt(m) - 1, 1);
            return {
                monthKey: month,
                name: localDate.toLocaleDateString('es-AR', { month: 'short' }),
                profit: data.income - data.expense,
                income: data.income,
                expense: data.expense
            };
        }).reverse();
    }, [monthlyBalance]);

    const handleSaveCategory = async () => {
        if (!catName.trim()) return;
        
        if (editingCategoryId) {
            const { error } = await supabase.from('categories').update({ 
                name: catName, 
                icon: catIcon, 
                is_offer: catIsOffer,
                image_url: catImageUrl
            }).eq('id', editingCategoryId);
            if (error) { console.error('Error updating category:', error); alert('Error updating category'); }
        } else {
            const { error } = await supabase.from('categories').insert([{ 
                name: catName, 
                icon: catIcon, 
                is_offer: catIsOffer,
                image_url: catImageUrl,
                tenant_id: tenant?.id 
            }]);
            if (error) { console.error('Error creating category:', error); alert('Error creating category'); }
        }
        
        setCatName('');
        setCatIsOffer(false);
        setCatTargetDepartments(['kitchen']);
        setCatImageUrl('');
        setEditingCategoryId(null);
        setIsCategoryModalOpen(false);
        refetchData?.();
        if (tenant?.id) broadcastTenantChange(tenant.id);
    };

    const openEditCategory = (cat: Category) => {
        setEditingCategoryId(cat.id);
        setCatName(cat.name);
        setCatIcon(cat.icon || '🍔');
        setCatTargetDepartments(cat.target_departments || ['kitchen']);
        setCatIsOffer(cat.is_offer || false);
        setCatImageUrl((cat as any).image_url || '');
        setIsCategoryModalOpen(true);
    };

    const handleSaveProduct = async () => {
        if (!prodName.trim() || !prodPrice || !activeCategoryId) return;

        const productData: any = {
            name: prodName,
            price: parseFloat(prodPrice),
            category_id: activeCategoryId,
            description: prodDesc.trim(),
            image_url: prodImage,
            custom_question: prodCustomQuestion.trim(),
            is_question_required: prodIsQuestionRequired,
            sale_by_weight: prodSaleByWeight,
            base_weight: prodSaleByWeight ? 1 : null,
            base_weight_unit: prodSaleByWeight ? 'kg' : null
        };

        let prodId = editingProductId;

        if (editingProductId) {
            const { error: prodError } = await supabase.from('products').update(productData).eq('id', editingProductId);
            if (prodError) {
                console.error('Error updating product:', prodError);
                alert('Error updating product');
                return;
            }
        } else {
            productData.tenant_id = tenant?.id;
            const { data: prodDataResponse, error: prodError } = await supabase.from('products').insert([productData]).select().single();
            if (prodError || !prodDataResponse) {
                console.error('Error creating product:', prodError);
                alert('Error creating product');
                return;
            }
            prodId = prodDataResponse.id;
        }

        if (editingProductId && prodId) {
            await supabase.from('product_ingredients').delete().eq('product_id', prodId);
        }

        if (prodIngredients.length > 0 && prodId) {
            const piInserts = prodIngredients.map(pi => ({
                product_id: prodId,
                ingredient_id: pi.ingredient_id,
                quantity_used: pi.quantity_used,
                tenant_id: tenant?.id
            }));
            const { error: piError } = await supabase.from('product_ingredients').insert(piInserts);
            if (piError) {
                console.error('Error adding ingredients:', piError);
                alert('Error adding ingredients to product');
            }
        }

        setProdName(''); setProdDesc(''); setProdPrice(''); setProdImage(PRESET_IMAGES[0].url); setProdIngredients([]);
        setProdCustomQuestion(''); setProdIsQuestionRequired(false);
        setProdSaleByWeight(false); setProdBaseWeight(''); setProdBaseWeightUnit('g');
        setEditingProductId(null);
        setIsProductModalOpen(false);
        refetchData?.();
        if (tenant?.id) broadcastTenantChange(tenant.id);
    };

    const openEditProduct = (prod: Product, catId: string) => {
        setEditingProductId(prod.id);
        setActiveCategoryId(catId);
        setProdName(prod.name);
        setProdDesc(prod.description || '');
        setProdPrice(prod.price.toString());
        setProdImage(prod.image_url || PRESET_IMAGES[0].url);
        setProdCustomQuestion(prod.custom_question || '');
        setProdIsQuestionRequired(prod.is_question_required || false);
        setProdSaleByWeight(prod.sale_by_weight || false);
        setProdBaseWeight(prod.base_weight ? prod.base_weight.toString() : '');
        setProdBaseWeightUnit(prod.base_weight_unit || 'g');
        
        const existingIngs = productIngredients.filter(pi => pi.product_id === prod.id);
        setProdIngredients(existingIngs);
        setIsProductModalOpen(true);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            alert('Error uploading image');
            return;
        }

        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        setProdImage(data.publicUrl);
    };

    // Add a cleanup effect for the scanner
    useEffect(() => {
        if (!showScanner && scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        } else if (showScanner && !scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            scannerRef.current = scanner;
            scanner.render(
                (decodedText) => {
                    setStkBarcode(decodedText);
                    setShowScanner(false);
                },
                (error) => {
                    // ignore errors during scanning, usually just "not found yet"
                }
            );
        }
    }, [showScanner]);

    const handleSaveStock = async () => {
        if (!stkName.trim() || !stkPrice || (!editingStockId && !stkLevel)) return;
        
        const newUnitPrice = parseFloat(stkPrice);
        let newStockLevel = 0;
        let diff = 0;
        let isNew = true;
        if (editingStockId) {
            isNew = false;
            const oldIng = ingredients.find(i => i.id === editingStockId);
            const oldStock = oldIng ? oldIng.stock_level : 0;
            if (stockUpdateMode === 'add') {
                diff = parseFloat(stkQtyToAdd || '0');
                newStockLevel = oldStock + diff;
            } else {
                newStockLevel = parseFloat(stkLevel || '0');
                diff = newStockLevel - oldStock;
            }
        } else {
            newStockLevel = parseFloat(stkLevel || '0');
            diff = newStockLevel;
        }

        const payload = {
            name: stkName,
            unit_price: newUnitPrice,
            stock_level: newStockLevel,
            unit: stkUnit,
            min_stock_alert: parseFloat(stkMinAlert),
            barcode: stkBarcode,
            is_fractionable: stkIsFractionable,
            tenant_id: tenant?.id
        };

        let ingredientId = editingStockId;

        if (editingStockId) {
            const { error } = await supabase.from('ingredients').update(payload).eq('id', editingStockId);
            if (error) {
                alert('Error al actualizar el insumo');
                return;
            }
        } else {
            const { data: newIng, error } = await supabase.from('ingredients').insert([payload]).select().single();
            if (error) {
                alert('Error al crear el insumo');
                return;
            }
            if (newIng) {
                ingredientId = newIng.id;
            }
        }

        // Si diff > 0, significa que se agregó stock físico real. Registramos esto como un gasto (saldo negativo) en la tabla 'expenses'
        if (diff > 0 && newUnitPrice > 0) {
            try {
                const totalCost = newUnitPrice * diff;
                const description = isNew
                    ? `Ingreso inicial de Insumo: ${stkName} (x${diff.toFixed(1)} ${stkUnit})`
                    : `Compra de Insumo: ${stkName} (x${diff.toFixed(1)} ${stkUnit})`;

                const { error: expenseError } = await supabase.from('expenses').insert([{
                    description: description,
                    amount: totalCost,
                    date: new Date().toISOString(),
                    type: 'purchase',
                    tenant_id: tenant?.id
                }]);

                if (expenseError) {
                    console.error("Error al registrar gasto automático del insumo:", expenseError);
                }
            } catch (err) {
                console.error("Excepción al registrar gasto automático del insumo:", err);
            }

            // Si además se colocó una fecha de vencimiento, la guardamos en la tabla ingredient_batches
            if (stkExpirationDate && ingredientId) {
                try {
                    const { error: batchError } = await supabase.from('ingredient_batches').insert([{
                        ingredient_id: ingredientId,
                        quantity: diff,
                        expiration_date: stkExpirationDate,
                        tenant_id: tenant?.id
                    }]);

                    if (batchError) {
                        console.error("Error al registrar lote de vencimiento:", batchError);
                    }
                } catch (err) {
                    console.error("Excepción al registrar lote de vencimiento:", err);
                }
            }
        }

        // Si diff < 0, significa que se redujo el stock (descarte/merma). Registramos esto como un gasto de desperdicios en la tabla 'expenses'
        if (diff < 0) {
            try {
                const totalCost = newUnitPrice * Math.abs(diff);
                const description = `Merma: ${stkName} - ${wasteReason} (x${Math.abs(diff).toFixed(1)} ${stkUnit})`;

                const { error: expenseError } = await supabase.from('expenses').insert([{
                    description: description,
                    amount: totalCost,
                    date: new Date().toISOString(),
                    type: 'other',
                    tenant_id: tenant?.id
                }]);

                if (expenseError) {
                    console.error("Error al registrar gasto automático de merma por edición:", expenseError);
                    alert("Error al registrar merma en base de datos: " + expenseError.message);
                }
            } catch (err) {
                console.error("Excepción al registrar gasto automático de merma por edición:", err);
            }
        }

        setIsStockModalOpen(false);
        setStkName(''); setStkPrice(''); setStkLevel(''); setStkUnit('uds'); setStkMinAlert('10'); setStkTargetDepartments(['kitchen']); setStkBarcode(''); setStkIsFractionable(false);
        setStkExpirationDate('');
        setEditingStockId(null);
        notifyChanges();
    };

    const handleSaveExpense = async () => {
        if (!expDesc.trim() || !expAmount) return;
        
        if (editingExpenseId) {
            const { error } = await supabase.from('expenses').update({
                description: expDesc,
                amount: parseFloat(expAmount),
                type: expType
            }).eq('id', editingExpenseId);
            if (error) alert('Error updating expense');
        } else {
            const { error } = await supabase.from('expenses').insert([{
                description: expDesc,
                amount: parseFloat(expAmount),
                date: new Date().toISOString(),
                type: expType,
                tenant_id: tenant?.id
            }]);
            if (error) alert('Error creating expense');
        }

        setExpDesc(''); setExpAmount(''); setExpType('purchase');
        setEditingExpenseId(null);
        setIsExpenseModalOpen(false);
        notifyChanges();
    };

    const openEditExpense = (exp: Expense) => {
        setEditingExpenseId(exp.id);
        setExpDesc(exp.description);
        setExpAmount(exp.amount.toString());
        setExpType(exp.type);
        setIsExpenseModalOpen(true);
    };

    const openEditStock = (item: Ingredient) => {
        setEditingStockId(item.id);
        setStkName(item.name);
        setStkPrice(item.unit_price.toString());
        setStkLevel(item.stock_level.toString()); // Total en modo 'set'
        setStkQtyToAdd(''); // Limpiar campo agregar
        setStockUpdateMode('add'); // Iniciar por defecto en modo "Agregar"
        setStkUnit(item.unit);
        setStkMinAlert(item.min_stock_alert.toString());
        setStkTargetDepartments(item.target_departments || ['kitchen']);
        setStkBarcode(item.barcode || '');
        setStkIsFractionable(item.is_fractionable || false);
        setWasteReason('Vencido');
        setStkExpirationDate('');
        setIsStockModalOpen(true);
    };

    const openWasteModal = (item: Ingredient) => {
        setSelectedWasteIngredient(item);
        setWasteQty('');
        setWasteReason('Vencido');
        setIsWasteModalOpen(true);
    };

    const handleSaveWaste = async () => {
        if (!selectedWasteIngredient || !wasteQty) return;
        const qty = parseFloat(wasteQty);
        if (isNaN(qty) || qty <= 0) {
            alert('Por favor, ingresa una cantidad válida mayor a 0.');
            return;
        }

        setIsSavingWaste(true);
        try {
            const newLevel = Math.max(0, selectedWasteIngredient.stock_level - qty);
            
            // 1. Actualizar el insumo en base de datos
            const { error: stockError } = await supabase
                .from('ingredients')
                .update({ stock_level: newLevel })
                .eq('id', selectedWasteIngredient.id);

            if (stockError) {
                alert('Error al actualizar el stock del insumo: ' + stockError.message);
                return;
            }

            // 2. Registrar el gasto por desperdicio/merma
            const totalCost = qty * selectedWasteIngredient.unit_price;
            const description = `Merma: ${selectedWasteIngredient.name} - ${wasteReason} (x${qty.toFixed(1)} ${selectedWasteIngredient.unit})`;
            
            const { error: expenseError } = await supabase.from('expenses').insert([{
                description: description,
                amount: totalCost,
                date: new Date().toISOString(),
                type: 'other',
                tenant_id: tenant?.id
            }]);

            if (expenseError) {
                console.error('Error al registrar gasto por merma:', expenseError);
                alert('Error al registrar merma en base de datos: ' + expenseError.message);
            }

            setIsWasteModalOpen(false);
            setSelectedWasteIngredient(null);
            setWasteQty('');
            notifyChanges();
        } catch (err) {
            console.error('Error al registrar merma:', err);
            alert('Error al registrar merma.');
        } finally {
            setIsSavingWaste(false);
        }
    };

    const toggleIngredient = (id: string) => {
        setProdIngredients(prev => {
            const exists = prev.find(i => i.ingredient_id === id);
            if (exists) return prev.filter(i => i.ingredient_id !== id);
            // Construct a valid ProductIngredient structure for local state (missing some required fields like id, product_id, but they are not needed for display)
            return [...prev, { ingredient_id: id, quantity_used: 1 } as any];
        });
    };

    const updateIngredientQty = (id: string, qty: number) => {
        setProdIngredients(prev => prev.map(i => i.ingredient_id === id ? { ...i, quantity_used: qty } : i));
    };

    const handleBarClick = (data: any) => {
        if (data && data.monthKey) {
            setSelectedMonthFilter(data.monthKey === selectedMonthFilter ? null : data.monthKey);
        }
    };

    const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) {
            console.error('Error updating order status:', orderId);
            alert('Error updating order status');
        }
    };

                                return (
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
                        <div className="bg-gradient-to-r from-amber-500/20 to-purple-600/20 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl animate-pulse">🔥</span>
                                <div>
                                    <h4 className="font-black text-sm uppercase text-amber-400">Período de Prueba Activo</h4>
                                    <p className="text-xs">
                                        Te quedan <strong className="text-xl">
                                            {Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                                        </strong> días gratis del plan <strong className="text-purple-400">{subscription.saas_plans?.name || 'Pro Ilimitado'}</strong>.
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

            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-hide">
                {(['dashboard', 'products', 'stock', 'sales', 'balance', 'config'] as const).map(v => {
                    const locked = isViewLocked(v);
                    return (
                        <button
                            key={v} 
                            onClick={() => {
                                if (locked) {
                                    setLockedFeatureModal(v);
                                } else {
                                    setView(v as any);
                                    if (v === 'config') setExpandedConfigSection(null);
                                }
                            }}
                            className={`flex-1 py-3 px-4 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                                view === v ? 'text-white shadow-lg' : 'text-slate-500'
                            } ${locked ? 'opacity-80' : ''}`}
                            style={view === v ? { backgroundColor: tenant?.theme_colors?.primary || '#f97316' } : {}}
                        >
                            {v === 'dashboard' ? <TrendingUp size={14} className="mx-auto" /> :
                            v === 'stock' ? 'Stock' :
                            v === 'products' ? 'Productos' :
                            v === 'balance' ? 'Balance' :
                            v === 'sales' ? (locked ? 'Ventas 🔒' : 'Ventas') :
                            v === 'config' ? 'Ajustes' : v}
                        </button>
                    );
                })}
            </div>

            {view === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Alertas de Vencimiento Cercano o Lotes Vencidos */}
                    {lotesPorVencer.length > 0 && (
                        <div className="glass p-5 rounded-[2.5rem] border border-red-500/20 bg-red-500/5 space-y-4 shadow-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                                    <AlertTriangle size={18} className="animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-red-500 font-black text-xs uppercase tracking-[0.2em] leading-none mb-1">Alertas de Vencimiento</h4>
                                    <p className="text-[8px] font-black text-slate-500 uppercase">Lotes con vencimiento cercano (7 días o menos)</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {lotesPorVencer.map(batch => {
                                    const isExpired = batch.diffDays < 0;
                                    return (
                                        <div key={batch.id} className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="font-black text-xs text-white block leading-tight">{batch.ingName}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 block">
                                                        Lote: {batch.quantity} {batch.ingUnit}
                                                    </span>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                    isExpired 
                                                        ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                                        : batch.diffDays === 0
                                                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                                                            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                                                }`}>
                                                    {isExpired 
                                                        ? `Vencido hace ${Math.abs(batch.diffDays)} días ⚠️` 
                                                        : batch.diffDays === 0
                                                            ? 'Vence Hoy 🔥'
                                                            : `Vence en ${batch.diffDays} días`}
                                                </span>
                                            </div>
                                            
                                            <button
                                                onClick={() => handleLiquidateBatch(batch)}
                                                className="w-full py-2.5 bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-wider rounded-xl text-slate-300 hover:text-white hover:border-green-500/30 hover:bg-green-500/5 transition-all flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                            >
                                                <CheckCircle size={11} className="text-green-500" />
                                                ¿Ya liquidaste este stock?
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass p-5 rounded-[2rem] border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Ingresos {salesPeriod}</p>
                            <h3 className="text-xl font-black text-white font-mono">{formatARS(totalRevenue)}</h3>
                        </div>
                        <div className="glass p-5 rounded-[2rem] border border-white/5">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pedidos</p>
                            <h3 className="text-2xl font-black text-white font-mono">{filteredOrders.length}</h3>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-[2.5rem] border border-white/5">
                        <h4 className="text-[10px] font-black uppercase text-amber-500 mb-4">Lo más vendido del mes</h4>
                        <div className="space-y-3">
                            {bestSellers.slice(0, 10).map((item, i) => {
                                const isTop1 = i === 0;
                                const isTop2 = i === 1;
                                const isTop3 = i === 2;

                                const cardClass = isTop1
                                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent shadow-[0_0_15px_rgba(251,191,36,0.08)] scale-[1.01]'
                                    : isTop2
                                        ? 'border-slate-300/30 bg-gradient-to-r from-slate-300/10 via-slate-400/5 to-transparent'
                                        : isTop3
                                            ? 'border-amber-700/30 bg-gradient-to-r from-amber-700/10 via-amber-800/5 to-transparent'
                                            : 'border-white/5 bg-slate-950/20';

                                const textClass = isTop1
                                    ? 'text-amber-400 font-black'
                                    : isTop2
                                        ? 'text-slate-200 font-bold'
                                        : isTop3
                                            ? 'text-amber-600/90 font-bold'
                                            : 'text-slate-300 font-semibold';

                                const badgeClass = isTop1
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : isTop2
                                        ? 'bg-slate-300/15 text-slate-300 border border-slate-300/25'
                                        : isTop3
                                            ? 'bg-amber-700/15 text-amber-600 border border-amber-700/25'
                                            : 'bg-amber-500/10 text-amber-500';

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`flex justify-between items-center p-3.5 rounded-2xl border transition-all duration-300 hover:scale-[1.005] ${cardClass}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-black/20 text-xs font-black">
                                                {isTop1 ? '🏆' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${(i + 1).toString().padStart(2, '0')}`}
                                            </div>
                                            <span className={`text-sm ${textClass}`}>{item.name}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black font-mono ${badgeClass}`}>
                                            {item.qty} uds
                                        </span>
                                    </div>
                                );
                            })}
                            {bestSellers.length === 0 && <p className="text-center text-slate-600 text-xs py-4">Sin datos de ventas en este periodo.</p>}
                        </div>
                    </div>
                </div>
            )}

            {view === 'stock' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-black uppercase italic text-sm">Insumos y Almacén</h3>
                        <button
                            onClick={() => { setEditingStockId(null); setStkName(''); setStkPrice(''); setStkLevel(''); setIsStockModalOpen(true); }}
                            className="bg-amber-500 p-2 rounded-xl text-white shadow-lg"><Plus size={18} /></button>
                    </div>

                    <div className="mb-2">
                        <ScannerVoiceInput onSearch={setSearchTermStock} placeholder="Buscar stock..." />
                    </div>

                    <div className="space-y-3">
                        {ingredients.filter(item => !searchTermStock || item.name.toLowerCase().includes(searchTermStock.toLowerCase()) || (item.barcode && item.barcode.toLowerCase() === searchTermStock.toLowerCase())).map(item => {
                            // Buscar los lotes cargados de este ingrediente
                            const lotesDeEsteIngrediente = (ingredientBatches || []).filter(b => b.ingredient_id === item.id);
                            
                            return (
                                <div key={item.id} className="glass rounded-3xl border border-white/5 overflow-hidden">
                                    {/* Cabecera del ingrediente (Clickable para editar) */}
                                    <div 
                                        onClick={() => openEditStock(item)}
                                        className="p-4 flex justify-between items-center active:bg-white/5 transition-all cursor-pointer"
                                    >
                                        <div>
                                            <span className="font-black text-white flex items-center gap-2 text-sm">
                                                {item.name}
                                                {item.target_departments?.includes('kitchen') && <span title="Cocina">🍳</span>}
                                                {item.target_departments?.includes('bartender') && <span title="Barra">🍹</span>}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Costo: {formatARS(item.unit_price)} / {item.unit}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right flex flex-col items-end">
                                                <p className={`font-black text-base ${item.stock_level <= item.min_stock_alert ? 'text-red-500' : 'text-green-500'}`}>
                                                    {item.stock_level.toFixed(1)} <span className="text-[10px] text-slate-500">{item.unit}</span>
                                                </p>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openWasteModal(item);
                                                    }}
                                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 active:scale-95 transition-all mt-1"
                                                >
                                                    <AlertTriangle size={8} />
                                                    Descarte
                                                </button>
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                                <button onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('¿Borrar insumo?')) await supabase.from('ingredients').delete().eq('id', item.id);
                                                }} className="text-red-500/30 hover:text-red-500 p-1">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Desglose de Lotes y Fechas de Vencimiento */}
                                    {lotesDeEsteIngrediente.length > 0 && (
                                        <div className="bg-slate-950/40 border-t border-white/5 p-3 space-y-2">
                                            <p className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1">
                                                <CalendarRange size={10} />
                                                Lotes Activos por Vencimiento
                                            </p>
                                            <div className="space-y-1.5">
                                                {lotesDeEsteIngrediente.map(batch => {
                                                    const expDate = parseLocalDate(batch.expiration_date);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    expDate.setHours(0, 0, 0, 0);
                                                    const diffTime = expDate.getTime() - today.getTime();
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    const isExpired = diffDays < 0;
                                                    
                                                    const formattedDate = parseLocalDate(batch.expiration_date).toLocaleDateString('es-AR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    });

                                                    return (
                                                        <div key={batch.id} className="bg-slate-900/50 px-3 py-2 rounded-xl flex justify-between items-center border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2.5 h-2.5 rounded-full ${
                                                                    isExpired ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' :
                                                                    diffDays <= 7 ? 'bg-amber-500 shadow-[0_0_6px_rgba(249,115,22,0.4)]' : 'bg-green-500'
                                                                }`} />
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-200">
                                                                        {batch.quantity.toFixed(1)} {item.unit}
                                                                    </p>
                                                                    <p className="text-[8px] text-slate-500 font-bold">
                                                                        Vence: {formattedDate} ({isExpired ? 'Vencido' : `vence en ${diffDays}d`})
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const confirmDelete = window.confirm(
                                                                        `⚠️ ¿Deseas eliminar este lote de ${batch.quantity.toFixed(1)} ${item.unit} de "${item.name}" con fecha de vencimiento ${formattedDate}?`
                                                                    );
                                                                    if (confirmDelete) {
                                                                        const { error } = await supabase.from('ingredient_batches').delete().eq('id', batch.id);
                                                                        if (error) {
                                                                            console.error("Error al eliminar lote:", error);
                                                                            alert("Error al eliminar el lote");
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-red-500/40 hover:text-red-500 p-1 transition-colors"
                                                                title="Eliminar este lote"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {view === 'products' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center px-2 flex-wrap gap-2">
                        <h3 className="font-black uppercase italic text-sm">Categorías y Menú</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setOffSelectedProducts([]);
                                    setOffDiscount('20');
                                    setOffLimitQty('');
                                    setIsOfferModalOpen(true);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 px-3.5 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
                            >
                                <Star size={12} className="fill-white" />
                                Crear Oferta
                            </button>
                            <button
                                onClick={() => { setEditingCategoryId(null); setCatName(''); setCatIcon('🍔'); setIsCategoryModalOpen(true); }}
                                className="bg-amber-500 hover:bg-amber-600 px-3.5 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-wider shadow-lg transition-all active:scale-95">
                                Nueva Categoría
                            </button>
                        </div>
                    </div>

                    {/* Listado de Ofertas Activas Programadas */}
                    {productOffers.length > 0 && (
                        <div className="glass p-5 rounded-[2rem] border border-purple-500/20 bg-purple-500/5 space-y-3">
                            <h4 className="font-black text-purple-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                                <Star size={14} className="fill-purple-400 text-purple-400" />
                                Ofertas Programadas Activas
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {productOffers.filter(offer => {
                                    const pIds = getProductIdsArray(offer.product_ids);
                                    // Conservar la oferta solo si contiene al menos un producto que esté activo
                                    return pIds.some(pid => {
                                        const prod = products.find(p => p.id === pid);
                                        return prod && prod.is_active !== false;
                                    });
                                }).map(offer => {
                                    const pIds = getProductIdsArray(offer.product_ids);
                                    const prodNames = pIds
                                        .map(pid => {
                                            const prod = products.find(p => p.id === pid);
                                            if (!prod) return null;
                                            return prod.is_active === false ? `${prod.name} (Inactivo)` : prod.name;
                                        })
                                        .filter(Boolean)
                                        .join(', ');
                                    
                                    const formattedStart = parseLocalDate(offer.start_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                    const formattedEnd = parseLocalDate(offer.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

                                    return (
                                        <div key={offer.id} className="bg-slate-950/40 p-3 rounded-2xl border border-white/5 flex justify-between items-center gap-3">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-purple-600/25 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                                                        {offer.discount_percentage}% OFF
                                                    </span>
                                                    <span className="text-[8px] text-slate-500 font-bold uppercase">
                                                        Validez: {formattedStart} al {formattedEnd}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-white font-bold leading-tight line-clamp-2">
                                                    {prodNames || 'Ninguno'}
                                                </p>
                                                {offer.limit_quantity && (
                                                    <p className="text-[8px] text-amber-500/80 font-black uppercase">
                                                        Límite: {offer.limit_quantity} unidades
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteOffer(offer.id)}
                                                className="text-red-500/30 hover:text-red-500 p-2 transition-colors"
                                                title="Eliminar Oferta"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <ScannerVoiceInput onSearch={setSearchTermProducts} placeholder="Buscar productos..." />
                    </div>

                    {categories.map(cat => {
                        let catActiveProducts = products.filter(p => p.category_id === cat.id && p.is_active !== false);
                        
                        if (searchTermProducts) {
                            const termLower = searchTermProducts.toLowerCase();
                            // Buscar ingrediente cuyo barcode coincida con el término
                            const matchedIng = ingredients.find(
                                i => i.barcode && i.barcode.toLowerCase() === termLower
                            );
                            const linkedProdIdsByBarcode = matchedIng
                                ? productIngredients
                                    .filter((pi: any) => pi.ingredient_id === matchedIng.id)
                                    .map((pi: any) => pi.product_id)
                                : [];
                            catActiveProducts = catActiveProducts.filter(p =>
                                p.name.toLowerCase().includes(termLower) ||
                                (p.barcode && p.barcode.toLowerCase() === termLower) ||
                                linkedProdIdsByBarcode.includes(p.id)
                            );
                        }
                        
                        if (searchTermProducts && catActiveProducts.length === 0) return null;

                        const activeProdIds = catActiveProducts.map(p => p.id);
                        const areAllSelected = activeProdIds.length > 0 && activeProdIds.every(id => selectedProductIds.includes(id));

                        return (
                            <div key={cat.id} className="space-y-3 bg-slate-900/30 p-4 rounded-[2rem] border border-white/5">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                                    <h4 className="font-black text-amber-500 flex items-center gap-2 text-sm">
                                        <span className="neon-icon">{cat.icon}</span> 
                                        {cat.name}
                                        {cat.target_departments?.includes('kitchen') && <span title="Cocina" className="text-[10px]">🍳</span>}
                                        {cat.target_departments?.includes('bartender') && <span title="Barra" className="text-[10px]">🍹</span>}
                                    </h4>
                                    <div className="flex gap-2">
                                        {catActiveProducts.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (areAllSelected) {
                                                        setSelectedProductIds(prev => prev.filter(id => !activeProdIds.includes(id)));
                                                    } else {
                                                        setSelectedProductIds(prev => [...prev.filter(id => !activeProdIds.includes(id)), ...activeProdIds]);
                                                    }
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                                                    areAllSelected 
                                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {areAllSelected ? 'Deseleccionar Cat.' : 'Sel. Cat.'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setActiveCategoryId(cat.id); setEditingProductId(null); setProdName(''); setProdPrice(''); setProdImage(PRESET_IMAGES[0].url); setProdIngredients([]); setIsProductModalOpen(true); }}
                                            className="text-green-500 bg-green-500/10 p-2 rounded-lg"><Plus size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }} className="text-blue-500/40 hover:text-blue-500 p-2"><Edit size={14} /></button>
                                        <button onClick={async () => {
                                            if (window.confirm('¿Borrar categoría?')) await supabase.from('categories').delete().eq('id', cat.id);
                                        }} className="text-red-500/40 p-2"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                {products.filter(p => p.category_id === cat.id).map(prod => {
                                // Calcular costo de receta para este producto
                                const recipeIngredients = productIngredients.filter(pi => pi.product_id === prod.id);
                                const costTotal = recipeIngredients.reduce((sum, pi) => {
                                    const ing = ingredients.find(i => i.id === pi.ingredient_id);
                                    return sum + (pi.quantity_used * (ing?.unit_price || 0));
                                }, 0);

                                // Detectar si tiene una oferta activa hoy
                                const activeOffer = (productOffers || []).find(offer => {
                                    const pIds = getProductIdsArray(offer.product_ids);
                                    if (!pIds.includes(prod.id)) return false;

                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);

                                    const parseDate = (dStr: string) => {
                                        const [y, m, d] = dStr.split('T')[0].split('-').map(Number);
                                        return new Date(y, m - 1, d);
                                    };

                                    const start = parseDate(offer.start_date);
                                    const end = parseDate(offer.end_date);
                                    end.setHours(23, 59, 59, 999);

                                    return today >= start && today <= end;
                                });
                                
                                const finalPrice = activeOffer 
                                    ? Math.round(prod.price * (1 - activeOffer.discount_percentage / 100)) 
                                    : prod.price;
                                
                                const profit = finalPrice - costTotal;
                                const marginPercent = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
                                
                                const marginColor = marginPercent <= 20 
                                    ? 'text-red-500 bg-red-500/10' 
                                    : marginPercent <= 50 
                                        ? 'text-amber-500 bg-amber-500/10' 
                                        : 'text-green-500 bg-green-500/10';

                                return (
                                    <div 
                                        key={prod.id} 
                                        className={`flex flex-col gap-2 p-3 hover:bg-white/5 rounded-2xl transition-all border ${
                                            activeOffer 
                                                ? 'border-purple-500/40 bg-gradient-to-r from-purple-950/20 to-slate-950/40 shadow-[0_0_15px_rgba(168,85,247,0.08)]' 
                                                : 'border-transparent hover:border-white/5 bg-slate-950/20'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="flex items-center gap-3">
                                                {prod.is_active !== false && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProductIds.includes(prod.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedProductIds(prev => [...prev, prod.id]);
                                                            } else {
                                                                setSelectedProductIds(prev => prev.filter(id => id !== prod.id));
                                                            }
                                                        }}
                                                        className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-800 text-amber-500 focus:ring-amber-500/25 cursor-pointer accent-amber-500"
                                                    />
                                                )}
                                                <img src={prod.image_url || ''} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-white text-xs">{prod.name}</span>
                                                        {prod.is_active === false && (
                                                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse">
                                                                Inactivo
                                                            </span>
                                                        )}
                                                        {activeOffer && (
                                                            <span className="flex items-center gap-1 bg-purple-600/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                                                <Star size={8} className="fill-purple-300 text-purple-300 animate-pulse" />
                                                                {activeOffer.discount_percentage}% OFF
                                                            </span>
                                                        )}
                                                    </div>
                                                    {prod.description && <p className="text-[9px] text-slate-500 font-bold truncate max-w-[150px]">{prod.description}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {activeOffer ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-purple-400 font-mono font-black">{formatARS(finalPrice)}</span>
                                                        <span className="text-[8px] text-slate-500 line-through font-bold leading-none mt-0.5">{formatARS(prod.price)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-amber-500 font-mono font-black">{formatARS(prod.price)}</span>
                                                )}
                                                <div className="flex gap-1.5">
                                                    {activeOffer && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveProductFromOffer(prod.id, activeOffer); }}
                                                            className="text-purple-400 bg-purple-500/10 p-2 rounded-lg hover:bg-purple-600 hover:text-white transition-all"
                                                            title="Dar de baja de Oferta"
                                                        >
                                                            <StarOff size={12} />
                                                        </button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); openEditProduct(prod, cat.id); }} className="text-blue-500 bg-blue-500/10 p-2 rounded-lg hover:bg-blue-500 hover:text-white transition-all"><Edit size={12} /></button>
                                                    {prod.is_active === false ? (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleActivateProduct(prod); }} 
                                                            className="text-green-500 bg-green-500/10 p-2 rounded-lg hover:bg-green-500 hover:text-white transition-all animate-pulse"
                                                            title="Activar producto"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteProduct(prod); }} 
                                                            className="text-red-500 bg-red-500/10 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                            title="Borrar producto"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-[8px] pl-12 border-t border-white/5 pt-2">
                                            <span className="font-bold text-slate-500 uppercase">
                                                Costo: <span className="font-mono text-slate-400 font-black">{formatARS(costTotal)}</span>
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-500 uppercase">
                                                    {activeOffer ? 'Ganancia Oferta:' : 'Ganancia:'} <span className="font-mono text-green-500 font-black">{formatARS(profit)}</span>
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-mono font-black ${marginColor}`} title={activeOffer ? 'Margen con Oferta' : 'Margen Estándar'}>
                                                    {marginPercent.toFixed(0)}% {activeOffer && '🏷️'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        );
                    })}
                </div>
            )}

            {view === 'balance' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="font-black uppercase italic text-sm">Rentabilidad Mensual</h3>
                        <button
                            onClick={() => { setEditingExpenseId(null); setExpDesc(''); setExpAmount(''); setExpType('purchase'); setIsExpenseModalOpen(true); }}
                            className="bg-red-500 p-2 rounded-xl text-white shadow-lg flex items-center gap-2 px-4">
                            <Plus size={18} /> <span className="text-[10px] font-black uppercase">Cargar Gasto</span>
                        </button>
                    </div>

                    {/* Rentabilidad Chart */}
                    <div className="glass p-4 rounded-[2.5rem] h-64 border border-white/5 relative group">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} onClick={(e: any) => handleBarClick(e?.activePayload?.[0]?.payload)}>
                                <defs>
                                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ea580c" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                    itemStyle={{ color: '#f97316', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(val: number | any) => formatARS(Number(val) || 0)}
                                />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                <ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.15)" strokeWidth={1} />
                                <Bar dataKey="profit" radius={4} minPointSize={6}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.monthKey === selectedMonthFilter ? '#f97316' : (entry.profit === 0 ? '#475569' : (entry.profit > 0 ? '#10b981' : '#ef4444'))}
                                            opacity={selectedMonthFilter && entry.monthKey !== selectedMonthFilter ? 0.3 : 0.8}
                                            className="transition-all duration-300 cursor-pointer"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-none">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Haz clic en un mes para ver detalle</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                            {selectedMonthFilter ? (() => {
                                const [y, m] = selectedMonthFilter.split('-');
                                return `Desglose: ${new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;
                            })() : 'Todos los Periodos'}
                        </h4>
                        {selectedMonthFilter && (
                            <button
                                onClick={() => setSelectedMonthFilter(null)}
                                className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-500"
                            >
                                <FilterX size={14} /> Ver Todo
                            </button>
                        )}
                    </div>

                    {monthlyBalance
                        .filter(([month]) => !selectedMonthFilter || month === selectedMonthFilter)
                        .map(([month, data]) => {
                            const totalWaste = data.transactions
                                .filter(t => t.type === 'waste' || t.description?.includes('Merma:'))
                                .reduce((sum, t) => sum + (t.amount || t.total_price || 0), 0);

                            return (
                                <div key={month} className="space-y-4 animate-in slide-in-from-bottom-4">
                                    {/* Financial Summary Card */}
                                    <div className="glass rounded-[2rem] overflow-hidden border border-white/5">
                                        <div className="bg-slate-900/80 p-5 flex justify-between items-center border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <Calendar size={18} className="text-amber-500" />
                                                <h4 className="font-black text-white uppercase text-sm">
                                                    {(() => {
                                                        const [y, m] = month.split('-');
                                                        return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                                                    })()}
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-black text-lg ${data.income - data.expense >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {formatARS(data.income - data.expense)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div 
                                                    onClick={() => {
                                                        if (expandedSection?.month === month && expandedSection?.type === 'income') {
                                                            setExpandedSection(null);
                                                        } else {
                                                            setExpandedSection({ month, type: 'income' });
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-2xl border flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-green-500/5 ${
                                                        expandedSection?.month === month && expandedSection?.type === 'income'
                                                            ? 'border-green-500 bg-green-500/10 ring-1 ring-green-500'
                                                            : 'bg-slate-950/40 border-green-500/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <ArrowUpCircle size={12} className="text-green-500" />
                                                        <span className="text-[7.5px] font-black uppercase text-slate-500">Ingresos</span>
                                                    </div>
                                                    <p className="font-black text-white text-xs leading-none mt-1">{formatARS(data.income)}</p>
                                                </div>
                                                <div 
                                                    onClick={() => {
                                                        if (expandedSection?.month === month && expandedSection?.type === 'expense') {
                                                            setExpandedSection(null);
                                                        } else {
                                                            setExpandedSection({ month, type: 'expense' });
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-2xl border flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-red-500/5 ${
                                                        expandedSection?.month === month && expandedSection?.type === 'expense'
                                                            ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500'
                                                            : 'bg-slate-950/40 border-red-500/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <ArrowDownCircle size={12} className="text-red-500" />
                                                        <span className="text-[7.5px] font-black uppercase text-slate-500">Gastos</span>
                                                    </div>
                                                    <p className="font-black text-white text-xs leading-none mt-1">{formatARS(data.expense)}</p>
                                                </div>
                                                <div 
                                                    onClick={() => {
                                                        if (expandedSection?.month === month && expandedSection?.type === 'waste') {
                                                            setExpandedSection(null);
                                                        } else {
                                                            setExpandedSection({ month, type: 'waste' });
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-2xl border flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-amber-500/5 ${
                                                        expandedSection?.month === month && expandedSection?.type === 'waste'
                                                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                                                            : 'bg-slate-950/40 border-amber-500/15'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <AlertTriangle size={12} className="text-amber-500" />
                                                        <span className="text-[7.5px] font-black uppercase text-slate-500">Mermas</span>
                                                    </div>
                                                    <p className="font-black text-white text-xs leading-none mt-1">{formatARS(totalWaste)}</p>
                                                </div>
                                            </div>

                                        {/* Top 3 Más Vendidos del Mes */}
                                        {(() => {
                                            const stats = Object.entries(data.productStats)
                                                .map(([pid, qty]) => ({
                                                    id: pid,
                                                    qty,
                                                    name: products.find(p => p.id === pid)?.name || 'Desconocido'
                                                }))
                                                .sort((a, b) => b.qty - a.qty)
                                                .slice(0, 3);

                                            if (stats.length === 0) return null;

                                            return (
                                                <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 space-y-2">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Trophy size={10} className="text-amber-500 animate-pulse" />
                                                        Top 3 Más Vendidos del Mes
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {stats.map((item, i) => {
                                                            const colorClass = i === 0 
                                                                ? 'border-amber-500/20 bg-amber-500/5 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.05)]' 
                                                                : i === 1 
                                                                    ? 'border-slate-300/10 bg-slate-300/5 text-slate-300' 
                                                                    : 'border-amber-700/10 bg-amber-700/5 text-amber-600';
                                                            const rankSymbol = i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉';
                                                            return (
                                                                <div key={item.id} className={`p-2 rounded-xl border text-center flex flex-col justify-between h-[52px] ${colorClass}`}>
                                                                    <span className="text-[7.5px] font-black uppercase tracking-wider block truncate">{item.name}</span>
                                                                    <div className="flex justify-center items-center gap-1">
                                                                        <span className="text-[10px]">{rankSymbol}</span>
                                                                        <span className="font-bold text-[9px] font-mono">{item.qty} uds</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Auditoría de Mermas y Pérdidas */}
                                        {(() => {
                                            const wasteTx = data.transactions.filter(t => t.type === 'waste' || t.description?.startsWith('Merma:'));
                                            if (wasteTx.length === 0) return null;

                                            const totalWaste = wasteTx.reduce((sum, t) => sum + (t.amount || t.total_price || 0), 0);

                                            // Agrupar por Motivo
                                            const byReason: Record<string, number> = {
                                                'Vencido': 0,
                                                'Error de Cocina': 0,
                                                'Consumo de Personal': 0,
                                                'Rotura': 0,
                                                'Otros': 0
                                            };

                                            // Agrupar por Insumo
                                            const byIngredient: Record<string, number> = {};

                                            wasteTx.forEach(t => {
                                                const amt = t.amount || t.total_price || 0;
                                                
                                                // Determinar motivo
                                                let reason = 'Otros';
                                                if (t.description?.includes('Vencido')) reason = 'Vencido';
                                                else if (t.description?.includes('Error de Cocina')) reason = 'Error de Cocina';
                                                else if (t.description?.includes('Consumo de Personal')) reason = 'Consumo de Personal';
                                                else if (t.description?.includes('Rotura')) reason = 'Rotura';
                                                
                                                byReason[reason] = (byReason[reason] || 0) + amt;

                                                // Determinar ingrediente
                                                let ingName = 'Desconocido';
                                                if (t.description?.startsWith('Merma: ')) {
                                                    const parts = t.description.replace('Merma: ', '').split(' - ');
                                                    if (parts[0]) ingName = parts[0];
                                                }
                                                byIngredient[ingName] = (byIngredient[ingName] || 0) + amt;
                                            });

                                            return (
                                                <div className="bg-red-950/20 p-5 rounded-2xl border border-red-500/10 space-y-4 animate-in slide-in-from-bottom-2">
                                                    <div className="flex justify-between items-center border-b border-red-500/10 pb-2.5">
                                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                                                            <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                                                            Auditoría de Mermas y Desperdicios
                                                        </p>
                                                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/10">
                                                            Pérdida Total: -{formatARS(totalWaste)}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Distribución por Motivo */}
                                                        <div className="space-y-2">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Pérdida por Canal / Motivo</p>
                                                            <div className="space-y-2">
                                                                {Object.entries(byReason)
                                                                    .filter(([_, amt]) => amt > 0)
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .map(([reason, amt]) => {
                                                                        const pct = Math.round((amt / totalWaste) * 100);
                                                                        const barColor = reason === 'Vencido' 
                                                                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]' 
                                                                            : reason === 'Error de Cocina' 
                                                                                ? 'bg-amber-500' 
                                                                                : reason === 'Rotura' 
                                                                                    ? 'bg-amber-600' 
                                                                                    : 'bg-slate-500';
                                                                        return (
                                                                            <div key={reason} className="space-y-1">
                                                                                <div className="flex justify-between text-[9px] font-bold text-slate-300">
                                                                                    <span>{reason}</span>
                                                                                    <span>{formatARS(amt)} ({pct}%)</span>
                                                                                </div>
                                                                                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                                                                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>

                                                        {/* Insumos más desperdiciados */}
                                                        <div className="space-y-2">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Insumos con Mayor Fuga de Dinero</p>
                                                            <div className="space-y-1.5">
                                                                {Object.entries(byIngredient)
                                                                    .sort((a, b) => b[1] - a[1])
                                                                    .slice(0, 3)
                                                                    .map(([ing, amt]) => (
                                                                        <div key={ing} className="flex justify-between items-center text-[10px] bg-slate-950/20 p-2 rounded-xl border border-white/5">
                                                                            <span className="font-bold text-slate-300">{ing}</span>
                                                                            <span className="text-red-400 font-mono font-bold">-{formatARS(amt)}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {expandedSection?.month === month ? (
                                            <div className="space-y-3 pt-2 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                                <div className="flex justify-between items-center bg-slate-900/40 p-2.5 rounded-xl border border-white/5">
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                        expandedSection.type === 'income' ? 'text-green-500' : expandedSection.type === 'expense' ? 'text-red-500' : 'text-amber-500'
                                                    }`}>
                                                        {expandedSection.type === 'income' ? '📋 Desglose de Ingresos' : expandedSection.type === 'expense' ? '💸 Desglose de Gastos' : '📉 Desglose de Mermas'}
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-500 uppercase">
                                                        {(() => {
                                                            const filtered = data.transactions.filter(t => {
                                                                if (expandedSection.type === 'income') return t.type === 'income';
                                                                if (expandedSection.type === 'waste') return t.type === 'waste' || t.description?.includes('Merma:');
                                                                return t.type !== 'income' && t.type !== 'waste' && !t.description?.includes('Merma:');
                                                            });
                                                            return `${filtered.length} transacciones`;
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                                    {(() => {
                                                        const filtered = data.transactions
                                                            .filter(t => {
                                                                if (expandedSection.type === 'income') return t.type === 'income';
                                                                if (expandedSection.type === 'waste') return t.type === 'waste' || t.description?.includes('Merma:');
                                                                return t.type !== 'income' && t.type !== 'waste' && !t.description?.includes('Merma:');
                                                            })
                                                            .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

                                                        if (filtered.length === 0) {
                                                            return <p className="text-center text-slate-600 text-[10px] font-bold py-4">No hay registros para esta categoría este mes.</p>;
                                                        }

                                                        return filtered.map((t: any) => (
                                                            <div key={t.id} className="group/item flex justify-between items-center text-[10px] p-2.5 bg-slate-950/20 border border-white/5 rounded-xl hover:bg-white/5 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={t.type === 'income' ? 'text-green-500' : 'text-red-500'}>
                                                                        ●
                                                                    </span>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-white leading-tight">
                                                                            {t.type === 'income' && <span className="text-amber-500 mr-1.5">#{t.order_number || '?'}</span>}
                                                                            {t.client_name || t.description}
                                                                        </span>
                                                                        <span className="text-slate-500 text-[7px] font-black uppercase mt-0.5">
                                                                            {new Date(t.created_at || t.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className={`font-black ${t.type === 'income' ? 'text-green-500' : 'text-white'}`}>
                                                                        {t.type === 'income' ? '+' : '-'}{formatARS(t.total_price || t.amount)}
                                                                    </span>
                                                                    {t.type !== 'income' && (
                                                                        <div className="flex gap-2">
                                                                            <button onClick={(e) => { e.stopPropagation(); openEditExpense(t); }} className="text-blue-400 hover:text-blue-300 p-1.5 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-white/5 transition-all" title="Editar Gasto"><Edit size={11} /></button>
                                                                            <button onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                if (window.confirm('¿Borrar registro?')) {
                                                                                     const { error } = await supabase.from('expenses').delete().eq('id', t.id);
                                                                                     if (error) alert('Error al borrar: ' + error.message);
                                                                                     notifyChanges();
                                                                                 }
                                                                            }} className="text-red-400 hover:text-red-300 p-1.5 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-white/5 transition-all" title="Eliminar"><Trash2 size={11} /></button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-3 text-center border border-dashed border-white/5 rounded-2xl bg-slate-950/10">
                                                <p className="text-slate-500 text-[8.5px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                                    💡 Toca Ingresos, Gastos o Mermas arriba para ver el desglose
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Performance Details: Only visible when a specific month is selected */}
                                {selectedMonthFilter === month && (
                                    <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-right-4">
                                        {/* Top Products Report */}
                                        <div className="glass rounded-[2rem] p-5 border border-white/5 space-y-4">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                                <Star className="text-yellow-500" size={18} />
                                                <h5 className="font-black text-white uppercase text-[10px] tracking-widest">Productos más vendidos</h5>
                                            </div>
                                            <div className="space-y-3">
                                                {Object.entries(data.productStats)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 5)
                                                    .map(([pid, qty]) => {
                                                        const p = products.find(prod => prod.id === pid);
                                                        const maxQty = Math.max(...Object.values(data.productStats));
                                                        return (
                                                            <div key={pid} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-300">{p?.name || 'Producto'}</span>
                                                                    <span className="font-black text-amber-500">{qty} uds</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${(qty / maxQty) * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                {Object.keys(data.productStats).length === 0 && (
                                                    <p className="text-center text-slate-600 text-[10px] font-bold py-4">Sin datos de productos este mes</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Most Consumed Ingredients Report */}
                                        <div className="glass rounded-[2rem] p-5 border border-white/5 space-y-4">
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                                <PieChart className="text-cyan-500" size={18} />
                                                <h5 className="font-black text-white uppercase text-[10px] tracking-widest">Insumos más consumidos</h5>
                                            </div>
                                            <div className="space-y-3">
                                                {Object.entries(data.ingredientStats)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 5)
                                                    .map(([iid, qty]) => {
                                                        const ing = ingredients.find(inv => inv.id === iid);
                                                        const maxQty = Math.max(...Object.values(data.ingredientStats));
                                                        return (
                                                            <div key={iid} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-300">{ing?.name || 'Insumo'}</span>
                                                                    <span className="font-black text-cyan-500">{qty.toFixed(1)} {ing?.unit}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${(qty / maxQty) * 100}%` }}></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                {Object.keys(data.ingredientStats).length === 0 && (
                                                    <p className="text-center text-slate-600 text-[10px] font-bold py-4">Sin datos de insumos este mes</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )})}
                </div>
            )}

            {view === 'sales' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex gap-2 p-1 bg-slate-900 rounded-xl overflow-x-auto scrollbar-hide">
                        {(['daily', 'weekly', 'yearly'] as const).map(p => (
                            <button
                                key={p} onClick={() => setSalesPeriod(p)}
                                className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase transition-all ${salesPeriod === p ? 'bg-slate-800 text-amber-500' : 'text-slate-600'}`}
                            >
                                {p === 'daily' ? 'Hoy' : p === 'weekly' ? 'Semana' : 'Año'}
                            </button>
                        ))}
                    </div>

                    {salesPeriod === 'daily' && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                            {/* Fila de acción superior (Cierre de Caja) */}
                            <div className="flex justify-between items-center bg-slate-950/20 p-3 rounded-3xl border border-white/5 backdrop-blur-sm">
                                <div className="flex items-center gap-2 pl-2">
                                    <Wallet size={16} className="text-amber-500" />
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cierre Diario</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleShareBox}
                                        disabled={filteredOrders.length === 0}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-4 py-2.5 rounded-[2rem] font-black uppercase text-[9px] tracking-widest flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-blue-600/10"
                                    >
                                        <Share2 size={11} /> Compartir
                                    </button>
                                    <button
                                        onClick={handleCloseBox}
                                        disabled={isClosingBox || filteredOrders.length === 0}
                                        className="bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500 text-white px-4 py-2.5 rounded-[2rem] font-black uppercase text-[9px] tracking-widest flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-red-500/10"
                                    >
                                        {isClosingBox ? (
                                            <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                            <>🔒 Cierre de Caja</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tarjeta Principal de Ingreso de Hoy */}
                            <div 
                                className="relative overflow-hidden p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col justify-between"
                                style={{
                                    background: `linear-gradient(135deg, ${tenant?.theme_colors?.primary || '#f97316'} 0%, #7c2d12 100%)`
                                }}
                            >
                                <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                    <TrendingUp size={150} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-200/80">Ventas Totales Facturadas</p>
                                    <h2 className="text-3xl font-black text-white font-mono tracking-tight">{formatARS(dailyStats.total)}</h2>
                                </div>
                                <p className="text-[8px] font-black text-amber-100/50 uppercase mt-4">
                                    {filteredOrders.length} {filteredOrders.length === 1 ? 'Pedido Registrado' : 'Pedidos Registrados'} Hoy
                                </p>
                            </div>

                            {/* Grid de 3 Columnas para Desglose */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Efectivo */}
                                <div className="glass p-4 rounded-3xl border border-green-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Efectivo</p>
                                    <p className="text-xs font-black text-white font-mono">{formatARS(dailyStats.efectivo)}</p>
                                </div>

                                {/* Plataformas */}
                                <div className="glass p-4 rounded-3xl border border-amber-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Apps (Plataformas)</p>
                                    <p className="text-xs font-black text-white font-mono">{formatARS(dailyStats.rappi + dailyStats.pedidosya)}</p>
                                </div>

                                {/* Débito */}
                                <div className="glass p-4 rounded-3xl border border-blue-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Débito</p>
                                    <p className="text-xs font-black text-white font-mono">{formatARS(dailyStats.debito)}</p>
                                </div>
                            </div>

                            {/* Listado Detallado de Comandas de Hoy */}
                            <div className="space-y-3 pt-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-1.5">Comandas de Hoy</h4>
                                {filteredOrders.length === 0 ? (
                                    <p className="text-center text-slate-600 py-10 font-bold uppercase text-[9px] tracking-widest">No hay pedidos registrados hoy</p>
                                ) : (
                                    filteredOrders.map(order => (
                                        <div key={order.id} className="glass p-4 rounded-3xl border border-white/5 flex flex-col gap-3 transition-all hover:border-white/10 bg-slate-950/20">
                                            <div 
                                                onClick={() => setExpandedModalOrderId(expandedModalOrderId === order.id ? null : order.id)}
                                                className="flex justify-between items-center cursor-pointer select-none"
                                            >
                                                <div className="text-left">
                                                    <p className="font-black text-sm text-white">
                                                        <span className="text-amber-500 mr-1.5">#{order.order_number || '?'}</span>
                                                        {order.client_name}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-right">
                                                        <p className="font-black text-amber-500 font-mono text-xs">{formatARS(order.total_price)}</p>
                                                        <span className="text-[7px] font-black uppercase text-slate-600">
                                                            {order.origin === 'rappi' ? '🍊 Rappi (Plataforma)' : order.origin === 'pedidosya' ? '🎒 PedidosYa' : order.payment_method === 'efectivo' ? '💵 Efectivo' : order.payment_method === 'debito' ? '💳 Débito' : order.payment_method === 'credito' ? '💳 Crédito' : '💳 Pago Digital'}
                                                        </span>
                                                    </div>
                                                    <ChevronRight 
                                                        size={12} 
                                                        className={`text-slate-500 transition-transform duration-300 ${expandedModalOrderId === order.id ? 'rotate-90 text-amber-500' : ''}`} 
                                                    />
                                                </div>
                                            </div>

                                            {expandedModalOrderId === order.id && (
                                                <div className="pt-3 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center pb-0.5 text-[8px] font-black uppercase tracking-wider text-slate-500">
                                                        <span>Productos</span>
                                                        <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[8px] text-slate-400">
                                                            ID: {order.id.slice(0, 8)}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {order.items?.map((item, itemIdx) => {
                                                            const prod = products.find(p => p.id === item.product_id);
                                                            return (
                                                                <div key={item.id || itemIdx} className="flex justify-between items-start bg-slate-900/60 p-2.5 rounded-xl border border-white/5 text-[11px]">
                                                                    <div className="space-y-0.5 text-left">
                                                                        <p className="font-bold text-slate-200">
                                                                            <span className="text-amber-500 font-black mr-1.5">{item.quantity}x</span> 
                                                                            {item.notes || prod?.name || 'Producto'}
                                                                            {item.notes && (
                                                                                <span className="text-[8px] text-slate-500 ml-1 font-bold italic lowercase">
                                                                                    ({prod?.name})
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-slate-400 text-[10px]">{formatARS(item.unit_price * item.quantity)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {salesPeriod === 'yearly' && (
                        <div className="space-y-6">
                            {/* Tarjeta Principal Anual */}
                            <div 
                                className="relative overflow-hidden p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col justify-between"
                                style={{
                                    background: `linear-gradient(135deg, #d97706 0%, #78350f 100%)`
                                }}
                            >
                                <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                    <PieChart size={150} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-200/80">Facturación Anual Total</p>
                                    <h2 className="text-3xl font-black text-white font-mono tracking-tight">{formatARS(yearlyTotal)}</h2>
                                </div>
                                <p className="text-[8px] font-black text-amber-100/50 uppercase mt-4">
                                    {yearlyOrders.length} {yearlyOrders.length === 1 ? 'Pedido Registrado' : 'Pedidos Registrados'} en el Año Calendario
                                </p>
                            </div>

                            {/* Calendario Histórico Agrupado */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Calendario de Ventas</h3>
                                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-[1rem]">
                                        <span className="text-[8px] font-black text-slate-500 uppercase">Ordenar:</span>
                                        <select
                                            value={yearlySortOption}
                                            onChange={(e) => setYearlySortOption(e.target.value as any)}
                                            className="bg-transparent text-[8px] font-black uppercase text-amber-500 outline-none cursor-pointer border-none"
                                        >
                                            <option value="chrono" className="bg-slate-950 text-slate-300">Cronológico</option>
                                            <option value="highest" className="bg-slate-950 text-slate-300">Mayor Facturación</option>
                                            <option value="lowest" className="bg-slate-950 text-slate-300">Menor Facturación</option>
                                        </select>
                                    </div>
                                </div>
                                {sortedMonthEntries.map(([month, days]) => {
                                    const isMonthExpanded = !!expandedMonths[month];
                                    const monthTotal = Object.values(days).flat().reduce((sum, o) => sum + getOrderRevenue(o), 0);
                                    
                                    return (
                                        <div key={month} className="glass rounded-3xl border border-white/5 overflow-hidden">
                                            <div 
                                                onClick={() => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }))}
                                                className="p-4 bg-slate-900/50 hover:bg-slate-900/85 transition-colors flex justify-between items-center cursor-pointer select-none"
                                            >
                                                <div>
                                                    <h4 className="font-black text-sm text-slate-200 uppercase tracking-wide">{month}</h4>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">{Object.keys(days).length} días con ventas</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-black text-amber-500 text-sm">{formatARS(monthTotal)}</span>
                                                    <ChevronRight 
                                                        size={16} 
                                                        className={`text-slate-500 transition-transform duration-300 ${isMonthExpanded ? 'rotate-90 text-amber-500' : ''}`} 
                                                    />
                                                </div>
                                            </div>
 
                                            {isMonthExpanded && (
                                                <div className="p-3 bg-slate-950/20 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    {Object.entries(days).map(([dayKey, dayOrders]) => {
                                                        const dayDate = new Date(dayKey + 'T00:00:00');
                                                        const dayLabel = dayDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
                                                        const dayTotal = dayOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);
                                                        
                                                        return (
                                                            <div 
                                                                key={dayKey}
                                                                onClick={() => setSelectedDaySales({ dayLabel, orders: dayOrders })}
                                                                className="flex justify-between items-center bg-slate-900/40 hover:bg-slate-900 border border-white/5 p-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-all"
                                                            >
                                                                <div>
                                                                    <p className="text-xs font-black text-slate-300">{dayLabel}</p>
                                                                    <p className="text-[8px] font-black text-slate-500 uppercase">{dayOrders.length} {dayOrders.length === 1 ? 'Pedido' : 'Pedidos'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-black text-slate-400 text-xs">{formatARS(dayTotal)}</span>
                                                                    <ChevronRight size={12} className="text-slate-600" />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {sortedMonthEntries.length === 0 && (
                                    <p className="text-center text-slate-600 py-20 font-bold uppercase tracking-widest">Sin Ventas Registradas en el Año</p>
                                )}
                            </div>
                        </div>
                    )}

                    {salesPeriod === 'weekly' && (() => {
                        const monthNames = [
                            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
                        ];
                        const currentMonthName = monthNames[new Date().getMonth()];

                        return (
                            <div className="space-y-6">
                                {/* Fila superior de información */}
                                <div className="flex justify-between items-center bg-slate-950/20 p-3 rounded-3xl border border-white/5 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 pl-2">
                                        <Calendar size={16} className="text-blue-500" />
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Balance Mensual por Semanas</span>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase pr-2 bg-slate-900 border border-slate-800/80 px-3 py-1 rounded-[1rem]">{currentMonthName}</span>
                                </div>

                                {/* Tarjeta Principal de la Semana en Curso */}
                                <div 
                                    className="relative overflow-hidden p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col justify-between"
                                    style={{
                                        background: `linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)`
                                    }}
                                >
                                    <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                        <TrendingUp size={150} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-200/80">Total en la Semana en Curso</p>
                                        <h2 className="text-3xl font-black text-white font-mono tracking-tight">{formatARS(currentWeekStats.total)}</h2>
                                    </div>
                                    <p className="text-[8px] font-black text-blue-100/50 uppercase mt-4">
                                        {currentWeekStats.ordersCount} {currentWeekStats.ordersCount === 1 ? 'Pedido Registrado' : 'Pedidos Registrados'} en esta Semana
                                    </p>
                                </div>

                                {/* Grid de 3 Columnas para Desglose de la Semana en Curso */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="glass p-4 rounded-3xl border border-green-500/10 bg-slate-950/40 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Efectivo</p>
                                        <p className="text-xs font-black text-white font-mono">{formatARS(currentWeekStats.efectivo)}</p>
                                    </div>
                                    <div className="glass p-4 rounded-3xl border border-amber-500/10 bg-slate-950/40 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Apps (Plataformas)</p>
                                        <p className="text-xs font-black text-white font-mono">{formatARS(currentWeekStats.rappi + currentWeekStats.pedidosya)}</p>
                                    </div>
                                    <div className="glass p-4 rounded-3xl border border-blue-500/10 bg-slate-950/40 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-1">Débito</p>
                                        <p className="text-xs font-black text-white font-mono">{formatARS(currentWeekStats.debito)}</p>
                                    </div>
                                </div>

                                {/* Calendario de Semanas del Mes */}
                                <div className="space-y-4 pt-2">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 pl-2">Semanas del Mes</h3>
                                    {Object.entries(weeklyOrdersGrouped)
                                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                                        .map(([weekStr, weekOrders]) => {
                                            const weekNum = Number(weekStr);
                                            const isWeekExpanded = !!expandedWeeksState[weekNum];
                                            const weekTotal = weekOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);

                                            // Agrupar pedidos de la semana por día
                                            const weekOrdersGroupedByDay: Record<string, Order[]> = {};
                                            weekOrders.forEach(o => {
                                                const date = new Date(o.created_at);
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                const dayKey = `${year}-${month}-${day}`;

                                                if (!weekOrdersGroupedByDay[dayKey]) {
                                                    weekOrdersGroupedByDay[dayKey] = [];
                                                }
                                                weekOrdersGroupedByDay[dayKey].push(o);
                                            });

                                            return (
                                                <div key={weekNum} className="glass rounded-[2rem] border border-white/5 overflow-hidden transition-all hover:border-white/10">
                                                    <div 
                                                        onClick={() => setExpandedWeeksState(prev => ({ ...prev, [weekNum]: !prev[weekNum] }))}
                                                        className="p-5 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex justify-between items-center cursor-pointer select-none"
                                                    >
                                                        <div>
                                                            <h4 className="font-black text-sm text-slate-200">Semana {weekNum} de {currentMonthName}</h4>
                                                            <p className="text-[8px] font-bold text-slate-500 uppercase">{weekOrders.length} {weekOrders.length === 1 ? 'comanda registrada' : 'comandas registradas'}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono font-black text-blue-400 text-sm">{formatARS(weekTotal)}</span>
                                                            <ChevronRight 
                                                                size={16} 
                                                                className={`text-slate-500 transition-transform duration-300 ${isWeekExpanded ? 'rotate-90 text-blue-500' : ''}`} 
                                                            />
                                                        </div>
                                                    </div>

                                                    {isWeekExpanded && (
                                                        <div className="p-4 bg-slate-950/25 border-t border-white/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                            {/* Lista de Días de la Semana */}
                                                            <div className="space-y-3">
                                                                {Object.entries(weekOrdersGroupedByDay)
                                                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                                                    .map(([dayKey, dayOrders]) => {
                                                                        const isDayExpanded = !!expandedMonths[dayKey];
                                                                        const dayDate = new Date(dayKey + 'T00:00:00');
                                                                        const dayLabel = dayDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                                                                        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total_price, 0);

                                                                        return (
                                                                            <div key={dayKey} className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                                                                                <div 
                                                                                    onClick={() => setExpandedMonths(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))}
                                                                                    className="p-3 bg-slate-900/50 hover:bg-slate-900/70 transition-colors flex justify-between items-center cursor-pointer select-none"
                                                                                >
                                                                                    <div>
                                                                                        <h5 className="font-bold text-[11px] text-slate-300 capitalize">{dayLabel}</h5>
                                                                                        <p className="text-[8px] font-bold text-slate-500 uppercase">{dayOrders.length} {dayOrders.length === 1 ? 'comanda' : 'comandas'}</p>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-mono font-black text-blue-400 text-[11px]">{formatARS(dayTotal)}</span>
                                                                                        <ChevronRight 
                                                                                            size={12} 
                                                                                            className={`text-slate-500 transition-transform duration-300 ${isDayExpanded ? 'rotate-90 text-blue-500' : ''}`} 
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                {isDayExpanded && (
                                                                                    <div className="p-2.5 bg-slate-950/20 border-t border-white/5 space-y-2">
                                                                                        {dayOrders.map(order => (
                                                                                            <div key={order.id} className="bg-slate-900/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                                                                                                <div 
                                                                                                    onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                                                                    className="flex justify-between items-center cursor-pointer select-none"
                                                                                                >
                                                                                                    <div>
                                                                                                        <p className="font-black text-[11px]">
                                                                                                            <span className="text-amber-500 mr-1">#{order.order_number || '?'}</span>
                                                                                                            {order.client_name}
                                                                                                        </p>
                                                                                                        <p className="text-[7px] font-bold text-slate-500 uppercase">
                                                                                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                                        </p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <span className="font-mono font-black text-amber-500 text-[11px]">{formatARS(order.total_price)}</span>
                                                                                                        <ChevronRight 
                                                                                                            size={10} 
                                                                                                            className={`text-slate-500 transition-transform duration-300 ${expandedOrderId === order.id ? 'rotate-90 text-amber-500' : ''}`} 
                                                                                                        />
                                                                                                    </div>
                                                                                                </div>

                                                                                                {expandedOrderId === order.id && (
                                                                                                    <div className="pt-2 border-t border-white/5 space-y-1 text-[10px] animate-in slide-in-from-top-1 duration-150">
                                                                                                        <div className="flex justify-between items-center pb-0.5 text-[7px] font-black uppercase tracking-wider text-slate-500">
                                                                                                            <span>Productos</span>
                                                                                                            <span className="px-1 py-0.5 bg-slate-950 border border-slate-800 rounded text-[7px] text-slate-400">
                                                                                                                {order.payment_method === 'efectivo' ? '💵 Efectivo' : order.payment_method === 'debito' ? '💳 Débito' : order.payment_method === 'credito' ? '💳 Crédito' : '💳 Pago Digital'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div className="space-y-1">
                                                                                                            {order.items?.map(item => {
                                                                                                                const prod = products.find(p => p.id === item.product_id);
                                                                                                                return (
                                                                                                                    <div key={item.id} className="flex justify-between items-start bg-slate-950/40 p-2 rounded-lg border border-white/5">
                                                                                                                        <div className="space-y-0.5 text-left font-bold text-slate-200">
                                                                                                                            <span>
                                                                                                                                <span className="text-amber-500 font-black mr-1">{item.quantity}x</span> 
                                                                                                                                {item.notes || prod?.name || 'Producto'}
                                                                                                                                {item.notes && (
                                                                                                                                    <span className="text-[7px] text-slate-500 ml-1 font-bold italic lowercase">
                                                                                                                                        ({prod?.name})
                                                                                                                                    </span>
                                                                                                                                )}
                                                                                                                            </span>
                                                                                                                        </div>
                                                                                                                        <span className="font-mono font-bold text-slate-400 text-[9px]">{formatARS(item.unit_price * item.quantity)}</span>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            })}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    {Object.keys(weeklyOrdersGrouped).length === 0 && (
                                        <p className="text-center text-slate-600 py-20 font-bold uppercase tracking-widest">Sin Ventas este Mes</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}




            {view === 'config' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="px-2 mb-6">
                        <h3 className="font-black uppercase italic text-lg" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>Ajustes y Configuración</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Configura todos los aspectos de tu restaurante de forma centralizada</p>
                    </div>

                    <div className="space-y-4">

                        {/* Accordion: Identidad de Color */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'identidad' ? null : 'identidad')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    true 
                                      ? (expandedConfigSection === 'identidad' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'identidad' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: true ? (expandedConfigSection === 'identidad' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: true ? (expandedConfigSection === 'identidad' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Paintbrush className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">✅ Identidad de Color</span>
                                </div>
                                {expandedConfigSection === 'identidad' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'identidad' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                        {/* 1. Tema de Colores */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                <Paintbrush size={12} /> Identidad de Color de la App
                            </label>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-1 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block mb-1">Color Principal</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={cfgPrimary}
                                            onChange={(e) => setCfgPrimary(e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                                        />
                                        <span className="text-xs font-mono font-bold text-white uppercase">{cfgPrimary}</span>
                                    </div>
                                </div>

                                <div className="space-y-1 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block mb-1">Color de Fondo</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={cfgSecondary}
                                            onChange={(e) => setCfgSecondary(e.target.value)}
                                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                                        />
                                        <span className="text-xs font-mono font-bold text-white uppercase">{cfgSecondary}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Presets de Color */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Presets Recomendados</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { name: 'Naranja', primary: '#f97316', secondary: '#1e293b' },
                                    { name: 'Púrpura', primary: '#a855f7', secondary: '#1e1b4b' },
                                    { name: 'Esmeralda', primary: '#10b981', secondary: '#064e3b' },
                                    { name: 'Rubí', primary: '#ef4444', secondary: '#451a03' },
                                    { name: 'Eléctrico', primary: '#3b82f6', secondary: '#172554' },
                                    { name: 'Oro', primary: '#f59e0b', secondary: '#451a03' },
                                    { name: 'Fucsia', primary: '#ec4899', secondary: '#4d0727' }
                                ].map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            setCfgPrimary(p.primary);
                                            setCfgSecondary(p.secondary);
                                        }}
                                        className="py-1 px-2.5 rounded-lg border border-slate-800 text-[8px] font-black uppercase text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.primary }} />
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tema Claro / Oscuro */}
                        <div className="space-y-2 pt-1">
                            <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Tema Predeterminado</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCfgMode('dark')}
                                    className={`flex-1 py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        cfgMode === 'dark'
                                            ? 'bg-slate-900 border-white/10 text-white'
                                            : 'bg-slate-950/20 border-slate-900 text-slate-600 hover:text-slate-400'
                                    }`}
                                >
                                    <Moon size={12} className={cfgMode === 'dark' ? 'text-indigo-400' : ''} /> Tema Oscuro
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCfgMode('light')}
                                    className={`flex-1 py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                        cfgMode === 'light'
                                            ? 'bg-white border-slate-300 text-slate-900'
                                            : 'bg-slate-950/20 border-slate-900 text-slate-600 hover:text-slate-400'
                                    }`}
                                >
                                    <Sun size={12} className={cfgMode === 'light' ? 'text-amber-500' : ''} /> Tema Claro
                                </button>
                            </div>
                        </div>

                                </div>
                            )}
                        </div>

                        {/* Accordion: Personal y Roles */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'personal' ? null : 'personal')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    true 
                                      ? (expandedConfigSection === 'personal' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'personal' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: true ? (expandedConfigSection === 'personal' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: true ? (expandedConfigSection === 'personal' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">✅ Personal y Roles</span>
                                </div>
                                {expandedConfigSection === 'personal' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'personal' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                                    <AdminEmployeeTab tenant={tenant} />
                                    

                                    

                                </div>
                            )}
                        </div>

                        {/* Accordion: Horarios de Atención */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'business_hours' ? null : 'business_hours')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    cfgBusinessHours.enabled 
                                      ? (expandedConfigSection === 'business_hours' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'business_hours' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: cfgBusinessHours.enabled ? (expandedConfigSection === 'business_hours' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: cfgBusinessHours.enabled ? (expandedConfigSection === 'business_hours' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <CalendarRange className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{cfgBusinessHours.enabled ? '✅ ' : ''}Horarios de Atención</span>
                                </div>
                                {expandedConfigSection === 'business_hours' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'business_hours' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                                    <div className="space-y-3 pt-3 border-t border-white/5">
                                        <label className="text-[10px] font-black uppercase flex items-center gap-1 text-amber-500" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                            <CalendarRange size={12} /> Días y Horarios Operativos
                                        </label>
                                        <p className="text-[9px] text-slate-400 leading-relaxed">
                                            Define los turnos en los que el local acepta pedidos. Fuera de estos horarios, el carrito de compras se bloqueará automáticamente. Las reservas de mesa seguirán funcionando.
                                        </p>
                                        <ScheduleEditor cfg={cfgBusinessHours} setCfg={setCfgBusinessHours} primaryColor={tenant?.theme_colors?.primary || '#f97316'} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Accordion: Módulo y zonas de envío */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'envios' ? null : 'envios')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    cfgHasDelivery 
                                      ? (expandedConfigSection === 'envios' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'envios' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: cfgHasDelivery ? (expandedConfigSection === 'envios' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: cfgHasDelivery ? (expandedConfigSection === 'envios' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Truck className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{cfgHasDelivery ? '✅ ' : ''}Módulo y zonas de envío</span>
                                </div>
                                {expandedConfigSection === 'envios' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'envios' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                        {/* 2. Módulo de Envíos */}
                        <div className="space-y-3 pt-3 border-t border-white/5">
                            <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                <Package size={12} /> Módulo de Envíos
                            </label>
                            <p className="text-[9px] text-slate-400 leading-relaxed">
                                Habilita la gestión de envíos a domicilio, configuración de zonas y costos de entrega.
                            </p>

                            <label className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                                cfgHasDelivery
                                    ? 'bg-slate-900/60 border-amber-500/30 text-white'
                                    : 'bg-slate-950/20 border-slate-900 text-slate-500'
                            }`}
                                style={cfgHasDelivery ? { borderColor: `${tenant?.theme_colors?.primary || '#f97316'}40` } : {}}
                            >
                                <div className="flex flex-col pr-4">
                                    <span className="text-xs font-black">Activar Envíos (Delivery)</span>
                                    <span className="text-[8px] opacity-60 mt-0.5">Permite cargar pedidos con envío a domicilio.</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={cfgHasDelivery}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        setCfgHasDelivery(isChecked);
                                        // También actualizar cfgRoles para compatibilidad con código legado
                                        if (isChecked) {
                                            if (!cfgRoles.includes('delivery')) setCfgRoles([...cfgRoles, 'delivery']);
                                        } else {
                                            setCfgRoles(cfgRoles.filter(r => r !== 'delivery'));
                                        }
                                    }}
                                    className="hidden"
                                />
                                <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                        cfgHasDelivery
                                            ? 'border-transparent text-white'
                                            : 'border-slate-800 bg-slate-950'
                                    }`}
                                    style={cfgHasDelivery ? { backgroundColor: tenant?.theme_colors?.primary || '#f97316' } : {}}
                                >
                                    {cfgHasDelivery && <Check size={10} />}
                                </div>
                            </label>
                        </div>

                        {/* 2.5 Configuración de Zonas de Envío */}
                        {cfgHasDelivery && (
                            <div className="space-y-4 pt-3 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                    🚚 Zonas de Envío y Tarifas
                                </label>
                                <p className="text-[9px] text-slate-400 leading-relaxed">
                                    Define las zonas de entrega y sus costos asociados. Los clientes deberán elegir una de estas zonas al solicitar un envío.
                                </p>

                                <div className="space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-left">
                                    {/* Días de Envío Activos */}
                                    <div className="space-y-2">
                                        <span className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Días de Envío Activos</span>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 1, label: 'L', name: 'Lunes' },
                                                { id: 2, label: 'M', name: 'Martes' },
                                                { id: 3, label: 'M', name: 'Miércoles' },
                                                { id: 4, label: 'J', name: 'Jueves' },
                                                { id: 5, label: 'V', name: 'Viernes' },
                                                { id: 6, label: 'S', name: 'Sábado' },
                                                { id: 0, label: 'D', name: 'Domingo' }
                                            ].map((day) => {
                                                const isActive = cfgDeliveryDays.includes(day.id);
                                                return (
                                                    <button
                                                        key={day.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setCfgDeliveryDays(prev => 
                                                                isActive ? prev.filter(d => d !== day.id) : [...prev, day.id]
                                                            );
                                                        }}
                                                        title={day.name}
                                                        className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg border ${
                                                            isActive
                                                                ? 'text-white'
                                                                : 'bg-slate-900/60 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'
                                                        }`}
                                                        style={isActive ? { backgroundColor: cfgPrimary, borderColor: `${cfgPrimary}40`, boxShadow: `0 0 15px ${cfgPrimary}40` } : {}}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Botón de Pánico de Envíos */}
                                    <div className="space-y-2 pt-3 border-t border-white/5">
                                        <label className="text-[10px] font-black uppercase text-red-500 flex items-center gap-1.5">
                                            <AlertTriangle size={12} /> Emergencia: Suspender Envíos
                                        </label>
                                        <p className="text-[9px] text-slate-400 leading-relaxed">
                                            Usa este botón de pánico si el delivery tiene un problema (ej: se enfermó o rompió la moto). 
                                            Al activarlo, se desactiva inmediatamente la opción de envíos a domicilio para los clientes. 
                                            <span className="font-bold text-red-400"> RECUERDA: Si lo activas, debes desactivarlo manualmente para volver a recibir pedidos con envío a domicilio. Es solo para casos de emergencia.</span>
                                        </p>
                                        
                                        <button
                                            type="button"
                                            onClick={() => setCfgDeliveryPanic(!cfgDeliveryPanic)}
                                            className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                                                cfgDeliveryPanic 
                                                ? 'bg-red-500/20 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                                : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${cfgDeliveryPanic ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                    <AlertTriangle size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-xs font-black uppercase">{cfgDeliveryPanic ? 'Envíos Suspendidos' : 'Suspender Envíos'}</div>
                                                    <div className="text-[9px] opacity-80">{cfgDeliveryPanic ? 'Desactiva esto para volver a la normalidad' : 'Activar en caso de emergencia'}</div>
                                                </div>
                                            </div>
                                            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${cfgDeliveryPanic ? 'bg-red-500' : 'bg-slate-800'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${cfgDeliveryPanic ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </button>
                                    </div>

                                    {/* Horarios de Envío */}
                                    <div className="space-y-3 pt-3 border-t border-white/5">
                                        <label className="text-[10px] font-black uppercase flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                            <Calendar size={12} /> Horarios de Reparto
                                        </label>
                                        <p className="text-[9px] text-slate-400 leading-relaxed">
                                            Define en qué franjas horarias está disponible el servicio de delivery. Si configuras esto, los clientes no podrán elegir envío a domicilio fuera de estos horarios (verán un cartel informativo).
                                        </p>
                                        <ScheduleEditor cfg={cfgDeliveryHours} setCfg={setCfgDeliveryHours} primaryColor={tenant?.theme_colors?.primary || '#f97316'} />
                                    </div>

                                    {/* Lista de Zonas Agregadas */}
                                    <div className="space-y-2 pt-3 border-t border-white/5">
                                        <span className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Zonas Registradas</span>
                                        {cfgDeliveryZones.length === 0 ? (
                                            <p className="text-[9px] text-slate-550 italic pl-1">No hay zonas configuradas. Los envíos serán sin costo por defecto.</p>
                                        ) : (
                                            <div className="grid gap-2">
                                                {cfgDeliveryZones.map((zone, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-white/5">
                                                        <div>
                                                            <p className="text-xs font-black text-white">{zone.name}</p>
                                                            <p className="text-[8px] font-bold text-slate-450 uppercase">{zone.fee === 0 ? 'Envío Gratis' : `Costo: $${zone.fee.toLocaleString('es-AR')}`}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCfgDeliveryZones(prev => prev.filter((_, i) => i !== idx));
                                                            }}
                                                            className="p-2 bg-red-500/10 text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-all active:scale-95"
                                                            title="Eliminar Zona"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Inputs para Agregar Nueva Zona */}
                                    <div className="pt-3 border-t border-white/5 space-y-3">
                                        <span className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Agregar Nueva Zona</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[7.5px] font-bold uppercase text-slate-500 block ml-1">Nombre de la Zona</label>
                                                <input
                                                    type="text"
                                                    id="new-zone-name"
                                                    placeholder="Ej: Zona Centro"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs outline-none focus:border-amber-500/50"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7.5px] font-bold uppercase text-slate-500 block ml-1">Costo ($)</label>
                                                <input
                                                    type="number"
                                                    id="new-zone-fee"
                                                    placeholder="Ej: 500 (0 para gratis)"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs outline-none focus:border-amber-500/50"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nameEl = document.getElementById('new-zone-name') as HTMLInputElement;
                                                const feeEl = document.getElementById('new-zone-fee') as HTMLInputElement;
                                                
                                                if (nameEl && feeEl) {
                                                    const name = nameEl.value.trim();
                                                    const fee = parseFloat(feeEl.value);
                                                    
                                                    if (!name) {
                                                        alert("⚠️ Por favor ingresa el nombre de la zona.");
                                                        return;
                                                    }
                                                    if (isNaN(fee) || fee < 0) {
                                                        alert("⚠️ El precio de envío debe ser un número igual o mayor a 0.");
                                                        return;
                                                    }
                                                    
                                                    // Evitar zonas duplicadas
                                                    if (cfgDeliveryZones.some(z => z.name.toLowerCase() === name.toLowerCase())) {
                                                        alert("⚠️ Ya existe una zona con ese nombre.");
                                                        return;
                                                    }
                                                    
                                                    setCfgDeliveryZones(prev => [...prev, { name, fee }]);
                                                    nameEl.value = '';
                                                    feeEl.value = '';
                                                }
                                            }}
                                            className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                                        >
                                            ➕ Agregar Zona a la Lista
                                        </button>
                                    </div>
                                </div>
                                <AdminDeliverySettlement tenant={tenant} />
                            </div>
                        )}
                                </div>
                            )}
                        </div>

                        {/* Accordion: Cobros por Mercado Pago */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'mp' ? null : 'mp')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    !!cfgMercadopagoAccessToken 
                                      ? (expandedConfigSection === 'mp' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'mp' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: !!cfgMercadopagoAccessToken ? (expandedConfigSection === 'mp' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: !!cfgMercadopagoAccessToken ? (expandedConfigSection === 'mp' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Wallet className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{!!cfgMercadopagoAccessToken ? '✅ ' : ''}Cobros por Mercado Pago</span>
                                </div>
                                {expandedConfigSection === 'mp' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'mp' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                        {/* 3. Mercado Pago */}
                        <div className="space-y-4 pt-3 border-t border-white/5">
                            <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                <Smartphone size={12} /> Configuración de Mercado Pago
                            </label>

                            {/* Inputs de Mercado Pago */}
                            <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-left">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Configuración de Pasarela Mercado Pago</span>
                                
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Clave Pública (Public Key)</label>
                                    <input
                                        type="text"
                                        value={cfgMercadopagoPublicKey}
                                        onChange={(e) => setCfgMercadopagoPublicKey(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="APP_USR-..."
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Token de Acceso (Access Token)</label>
                                    <input
                                        type="password"
                                        value={cfgMercadopagoAccessToken}
                                        onChange={(e) => setCfgMercadopagoAccessToken(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="••••••••••••••••••••••••••••••••"
                                    />
                                </div>
                            </div>
                        </div>



                                </div>
                            )}
                        </div>



                        {/* Accordion: Perfil y Redes Sociales */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'social' ? null : 'social')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    true 
                                      ? (expandedConfigSection === 'social' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'social' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: true ? (expandedConfigSection === 'social' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: true ? (expandedConfigSection === 'social' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Share2 className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">✅ Perfil y Redes Sociales</span>
                                </div>
                                {expandedConfigSection === 'social' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'social' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                        {/* 4. Perfil Público y Redes Sociales */}
                        <div className="space-y-4 pt-3 border-t border-white/5">
                            <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                <Share2 size={12} /> Perfil Público y Redes Sociales
                            </label>

                            <div className="space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-left">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Identidad Visual & Redes</span>
                                
                                {/* Nombre del Local */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Nombre Público del Local</label>
                                    <input
                                        type="text"
                                        value={cfgName}
                                        onChange={(e) => setCfgName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="Ej. Mi Restaurante - Sucursal Norte"
                                    />
                                </div>
                                
                                {/* Descripción del Local */}
                                <div className="space-y-1 mt-3">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[8px] font-bold uppercase text-slate-500 block">Descripción del Local</label>
                                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">{cfgDescription.length} / 500 caract.</span>
                                    </div>
                                    <textarea
                                        value={cfgDescription}
                                        onChange={(e) => {
                                            if (e.target.value.length <= 500) {
                                                setCfgDescription(e.target.value);
                                            }
                                        }}
                                        rows={3}
                                        maxLength={500}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50 resize-none"
                                        placeholder="Describe tu local, especialidad (ej. comida sin TACC), si realizas ventas mayoristas, etc."
                                    />
                                </div>

                                {/* Foto de Perfil */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Foto de Perfil (Logo Circular)</label>
                                    <div className="flex items-center gap-3">
                                        {cfgProfilePictureUrl ? (
                                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0 bg-slate-900 relative group">
                                                <img src={cfgProfilePictureUrl} alt="Logo" className="w-full h-full object-cover" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setCfgProfilePictureUrl('')}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 text-[6px] font-black uppercase tracking-wider rounded-full transition-all"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center shrink-0 text-slate-600 bg-slate-900 text-[8px] font-black uppercase">
                                                Logo
                                            </div>
                                        )}
                                        <label className="flex-1 py-2 px-3 bg-slate-950 hover:bg-slate-900 text-neutral-300 font-bold rounded-xl text-center cursor-pointer text-[9px] uppercase border border-slate-800 active:scale-95 transition-all">
                                            Subir Foto de Perfil 🖼️
                                            <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                                        </label>
                                    </div>
                                </div>

                                {/* Banner de Portada */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1">Banner de Portada (Fondo Superior)</label>
                                    <div className="flex items-center gap-3">
                                        {cfgBannerUrl ? (
                                            <div className="w-12 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-slate-900 relative group">
                                                <img src={cfgBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setCfgBannerUrl('')}
                                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 text-[6px] font-black uppercase tracking-wider transition-all"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-8 rounded-lg border border-dashed border-slate-800 flex items-center justify-center shrink-0 text-slate-600 bg-slate-900 text-[8px] font-black uppercase">
                                                Banner
                                            </div>
                                        )}
                                        <label className="flex-1 py-2 px-3 bg-slate-950 hover:bg-slate-900 text-neutral-300 font-bold rounded-xl text-center cursor-pointer text-[9px] uppercase border border-slate-800 active:scale-95 transition-all">
                                            Subir Portada 🖼️
                                            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                                        </label>
                                    </div>
                                </div>

                                {/* Instagram */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1"><Instagram size={10} className="text-amber-500" /> Enlace de Instagram</label>
                                    <input
                                        type="text"
                                        value={cfgInstagram}
                                        onChange={(e) => setCfgInstagram(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="https://instagram.com/mi_local"
                                    />
                                </div>

                                {/* Facebook */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1"><Facebook size={10} className="text-amber-500" /> Enlace de Facebook</label>
                                    <input
                                        type="text"
                                        value={cfgFacebook}
                                        onChange={(e) => setCfgFacebook(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="https://facebook.com/mi_local"
                                    />
                                </div>

                                {/* WhatsApp de Contacto */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1"><Phone size={10} className="text-amber-500" /> WhatsApp / Celular de Contacto</label>
                                    <input
                                        type="text"
                                        value={cfgWhatsapp}
                                        onChange={(e) => setCfgWhatsapp(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="5491112345678 (Sin el + ni guiones)"
                                    />
                                </div>

                                {/* Dirección Física */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1">📍 Dirección Física del Local</label>
                                    <input
                                        type="text"
                                        value={cfgAddress}
                                        onChange={(e) => setCfgAddress(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="Ej: Av. Corrientes 1234, CABA"
                                    />
                                </div>

                                {/* Enlace Google Maps */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1">🗺️ Enlace de Google Maps</label>
                                    <input
                                        type="text"
                                        value={cfgGoogleMapsUrl}
                                        onChange={(e) => setCfgGoogleMapsUrl(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50"
                                        placeholder="Ej: https://maps.app.goo.gl/..."
                                    />
                                </div>

                                {/* Iframe o Enlace para incrustar Mapa */}
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold uppercase text-slate-500 block ml-1 flex items-center gap-1">💻 Mapa Incrustado (Iframe o URL de Compartir)</label>
                                    <textarea
                                        value={cfgMapsIframe}
                                        onChange={(e) => setCfgMapsIframe(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-500/50 min-h-[60px]"
                                        placeholder='Pega aquí el código <iframe> que te da Google Maps ("Incrustar un mapa") o la URL de inserción.'
                                    />
                                </div>

                                {/* Switch Sistema de Reseñas */}
                                <div className="pt-2 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">Sistema de Reseñas</span>
                                        <span className="text-[7.5px] text-slate-500 uppercase block font-semibold">Habilitar opiniones y calificaciones de clientes</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCfgReviewsEnabled(!cfgReviewsEnabled)}
                                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            cfgReviewsEnabled ? 'bg-amber-500' : 'bg-slate-800'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                cfgReviewsEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                            </div>
                        </div>

                                </div>
                            )}
                        </div>

                        {/* Accordion: Landing Page y Portal */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'landing' ? null : 'landing')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    cfgLandingConfig.enabled 
                                      ? (expandedConfigSection === 'landing' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400')
                                      : (expandedConfigSection === 'landing' ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 opacity-80')
                                }`}
                                style={{
                                    borderColor: cfgLandingConfig.enabled ? (expandedConfigSection === 'landing' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                    color: cfgLandingConfig.enabled ? (expandedConfigSection === 'landing' ? tenant?.theme_colors?.primary : undefined) : undefined,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <LayoutGrid className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">{cfgLandingConfig.enabled ? '✅ ' : ''}Landing Page y Portal</span>
                                </div>
                                {expandedConfigSection === 'landing' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'landing' && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 animate-in slide-in-from-top-2">
                                    {/* Enable Landing Page */}
                                    <div className="space-y-4 pt-3">
                                        <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                            <LayoutGrid size={12} /> Estado de Landing Page
                                        </label>
                                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                            <div>
                                                <h4 className="text-white text-xs font-bold uppercase tracking-wider">Landing Pública</h4>
                                                <p className="text-[9px] text-slate-400 mt-1 uppercase">Muestra una página de inicio antes del menú.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={cfgLandingConfig.enabled}
                                                    onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, enabled: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: cfgLandingConfig.enabled ? (tenant?.theme_colors?.primary || '#f97316') : undefined }}></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                                            <div>
                                                <h4 className="text-white text-xs font-bold uppercase tracking-wider">Muro Interactivo</h4>
                                                <p className="text-[9px] text-slate-400 mt-1 uppercase">Permite ver el chat y música en la landing.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={cfgLandingConfig.interactive_wall_enabled}
                                                    onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, interactive_wall_enabled: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: cfgLandingConfig.interactive_wall_enabled ? (tenant?.theme_colors?.primary || '#f97316') : undefined }}></div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Hero Configuration */}
                                    <div className="space-y-4 pt-3 border-t border-white/5">
                                        <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                            <ImageIcon size={12} /> Imagen de Ambiente (Fondo Principal)
                                        </label>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estilo de Portada</label>
                                            <select 
                                                value={cfgLandingConfig.hero_style || 'gradient'}
                                                onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, hero_style: e.target.value })}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                            >
                                                <option value="gradient">Solo Degradado Oscuro</option>
                                                <option value="image">Imagen Fotográfica</option>
                                                <option value="video">Video (URL)</option>
                                            </select>
                                        </div>

                                        {cfgLandingConfig.hero_style === 'video' && (
                                            <div className="space-y-2 animate-in fade-in zoom-in-95">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Video de Fondo (YouTube/MP4 URL)</label>
                                                <input 
                                                    type="text" 
                                                    value={cfgLandingConfig.hero_video_url || ''}
                                                    onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, hero_video_url: e.target.value })}
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                                    placeholder="Ej: https://..."
                                                />
                                            </div>
                                        )}

                                        {cfgLandingConfig.hero_style === 'image' && (
                                            <div className="space-y-4 animate-in fade-in zoom-in-95">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subir Imagen de Portada</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={cfgLandingConfig.hero_image_url || ''}
                                                            onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, hero_image_url: e.target.value })}
                                                            className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                                            placeholder="Sube una imagen o pega la URL"
                                                        />
                                                        <label className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl px-4 cursor-pointer transition-colors border border-white/10">
                                                            <Upload size={16} />
                                                            <input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                onChange={async (e) => {
                                                                    await handleLandingImageUpload(e);
                                                                    setCfgLandingConfig((prev: any) => ({ ...prev, hero_style: 'image' }));
                                                                }} 
                                                                className="hidden" 
                                                            />
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Alineación/Encuadre de la Imagen */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Encuadre (Alineación de la imagen)</label>
                                                    <select 
                                                        value={cfgLandingConfig.hero_position || 'center'}
                                                        onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, hero_position: e.target.value })}
                                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                                    >
                                                        <option value="center">Centro (Recomendado)</option>
                                                        <option value="top">Arriba</option>
                                                        <option value="bottom">Abajo</option>
                                                        <option value="left">Izquierda</option>
                                                        <option value="right">Derecha</option>
                                                    </select>
                                                    <p className="text-[9px] text-slate-500 pl-1">Ajusta esto si la parte importante de la foto se corta en el celular.</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Preview box */}
                                        <div className="mt-4 relative w-full h-40 rounded-2xl overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center">
                                            {cfgLandingConfig.hero_style === 'image' && cfgLandingConfig.hero_image_url ? (
                                                <img 
                                                    src={cfgLandingConfig.hero_image_url} 
                                                    alt="Hero Preview" 
                                                    className="w-full h-full object-cover opacity-60" 
                                                    style={{ objectPosition: cfgLandingConfig.hero_position || 'center' }}
                                                />
                                            ) : (
                                                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${tenant?.theme_colors?.primary || '#f97316'}40, #000000)` }} />
                                            )}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <h3 className="text-white text-2xl font-black drop-shadow-md tracking-tight uppercase">Ambiente</h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Módulos de Venta Profesionales */}
                                    <div className="space-y-4 pt-3 border-t border-white/5">
                                        <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                            <Star size={12} /> Módulos Profesionales
                                        </label>

                                        {/* Nuestra Esencia */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nuestra Esencia (Historia/Filosofía)</label>
                                            <textarea 
                                                value={cfgLandingConfig.about_text || ''}
                                                onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, about_text: e.target.value })}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors min-h-[80px]"
                                                placeholder="Cuenta a tus clientes quiénes son, qué los hace especiales o la historia de tu cocina..."
                                            />
                                            <p className="text-[9px] text-slate-500 pl-1">Se mostrará como un bloque de texto premium en la landing.</p>
                                        </div>

                                        {/* Carrusel Destacados */}
                                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5 mt-4">
                                            <div>
                                                <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Utensils size={14} /> Carrusel de Destacados</h4>
                                                <p className="text-[9px] text-slate-400 mt-1">Muestra dinámicamente platos del menú para tentar al cliente.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={cfgLandingConfig.featured_products_enabled !== false}
                                                    onChange={(e) => setCfgLandingConfig({ ...cfgLandingConfig, featured_products_enabled: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: cfgLandingConfig.featured_products_enabled !== false ? (tenant?.theme_colors?.primary || '#f97316') : undefined }}></div>
                                            </label>
                                        </div>
                                    </div>

                                        {/* GESTOR DE CARRUSEL DINÁMICO */}
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                                    <ImageIcon size={12} /> Carrusel Dinámico (Slides)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleAddCarouselSlide}
                                                    className="bg-white/10 hover:bg-white/20 text-[9px] text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                                >
                                                    <Plus size={12} /> Añadir Slide ({(cfgLandingConfig.custom_carousel || []).length}/10)
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {(cfgLandingConfig.custom_carousel || []).map((slide: any, idx: number) => (
                                                    <div key={slide.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-3 relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCarouselSlide(slide.id)}
                                                            className="absolute top-3 right-3 text-red-500 hover:text-red-400 bg-red-500/10 p-1.5 rounded-lg transition-colors"
                                                            title="Eliminar Slide"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        
                                                        <div className="flex flex-col sm:flex-row gap-4">
                                                            {/* Columna Izquierda: Imagen */}
                                                            <div className="w-full sm:w-1/3">
                                                                <div className="aspect-video bg-slate-950 rounded-xl border border-white/10 overflow-hidden relative group flex items-center justify-center">
                                                                    {(slide.image_url || (slide.id === 'def-1' ? '/defaults/carousel1.png' : slide.id === 'def-2' ? '/defaults/carousel2.png' : slide.id === 'def-3' ? '/defaults/carousel3.png' : '')) ? (
                                                                        <img 
                                                                            src={slide.image_url || (slide.id === 'def-1' ? '/defaults/carousel1.png' : slide.id === 'def-2' ? '/defaults/carousel2.png' : slide.id === 'def-3' ? '/defaults/carousel3.png' : '')} 
                                                                            alt="Slide" 
                                                                            className="w-full h-full object-cover" 
                                                                        />
                                                                    ) : (
                                                                        <div className="text-slate-600 flex flex-col items-center">
                                                                            <ImageIcon size={24} />
                                                                            <span className="text-[9px] mt-1">Sin imagen</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                        <label className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-600 transition-colors flex items-center gap-1">
                                                                            <Upload size={12} /> Subir
                                                                            <input type="file" accept="image/*" onChange={(e) => handleCarouselImageUpload(idx, e)} className="hidden" />
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={slide.image_url}
                                                                    onChange={(e) => handleUpdateCarouselSlide(idx, 'image_url', e.target.value)}
                                                                    placeholder={slide.id === 'def-1' ? "/defaults/carousel1.png (Por defecto)" : slide.id === 'def-2' ? "/defaults/carousel2.png (Por defecto)" : slide.id === 'def-3' ? "/defaults/carousel3.png (Por defecto)" : "URL de la imagen..."}
                                                                    className="w-full mt-2 bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[9px] outline-none"
                                                                />
                                                            </div>
                                                            
                                                            {/* Columna Derecha: Textos */}
                                                            <div className="w-full sm:w-2/3 space-y-2 pt-6 sm:pt-0">
                                                                <div>
                                                                    <label className="text-[8px] font-bold text-slate-500 uppercase ml-1 block mb-0.5">Título del Slide</label>
                                                                    <input
                                                                        type="text"
                                                                        value={slide.title}
                                                                        onChange={(e) => handleUpdateCarouselSlide(idx, 'title', e.target.value)}
                                                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-[11px] font-bold outline-none focus:border-amber-500"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[8px] font-bold text-slate-500 uppercase ml-1 block mb-0.5">Descripción</label>
                                                                    <textarea
                                                                        value={slide.description}
                                                                        onChange={(e) => handleUpdateCarouselSlide(idx, 'description', e.target.value)}
                                                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] outline-none focus:border-amber-500 min-h-[60px]"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[8px] font-bold text-slate-500 uppercase ml-1 block mb-0.5">Texto Destacado (Opcional, ej: "A 120 personas les gustó")</label>
                                                                    <input
                                                                        type="text"
                                                                        value={slide.badge_text}
                                                                        onChange={(e) => handleUpdateCarouselSlide(idx, 'badge_text', e.target.value)}
                                                                        placeholder='Ej: "A 120 personas les gustó esto"'
                                                                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] outline-none focus:border-amber-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(cfgLandingConfig.custom_carousel || []).length === 0 && (
                                                    <div className="text-center p-6 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed">
                                                        <ImageIcon className="mx-auto text-slate-600 mb-2" size={24} />
                                                        <p className="text-[10px] text-slate-500">Aún no has agregado ninguna diapositiva al carrusel.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                </div>
                            )}
                        </div>

                    </div>
                    
                    <div className="mt-8 pt-4 border-t border-slate-800 space-y-4">
                        {/* Status Messages */}
                        {configError && (
                            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                                <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide leading-tight">{configError}</p>
                            </div>
                        )}

                        {configSuccess && (
                            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                                <p className="text-green-500 text-[10px] font-bold uppercase tracking-wide leading-tight">Configuración guardada con éxito.</p>
                            </div>
                        )}

                    </div>




                        {/* Accordion: Centro de Reportes */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'reports' ? null : 'reports')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    expandedConfigSection === 'reports' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <BarChart2 className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">Centro de Reportes</span>
                                </div>
                                {expandedConfigSection === 'reports' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'reports' && (() => {
                const { start, end } = getFilteredDateRange();
                
                // Calculate KPIs for the period
                const filteredOrders = orders.filter(o => {
                    const d = new Date(o.created_at);
                    return d >= start && d <= end;
                });
                
                const filteredWaste = expenses.filter(e => {
                    const d = new Date(e.date || new Date());
                    return d >= start && d <= end && (e.type === 'waste' || e.description?.startsWith('Merma:'));
                });

                const totalSales = filteredOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);
                const orderCount = filteredOrders.length;
                const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;
                const totalWaste = filteredWaste.reduce((sum, e) => sum + (e.amount || 0), 0);

                
                                return (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-end px-2">
                        <div>
                            <h3 className="font-black uppercase italic text-sm bg-gradient-to-r from-amber-400 to-red-500 bg-clip-text text-transparent">Centro de Reportes</h3>
                            <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Exporta la información clave de tu negocio</p>
                        </div>
                        <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-2xl border border-white/10 active:scale-95 transition-all shadow-lg flex items-center justify-center" title="Imprimir Resumen Ejecutivo">
                            <Printer size={18} className="text-slate-300" />
                        </button>
                    </div>

                    {/* Selector de Rango */}
                    <div className="glass p-5 rounded-[2rem] border border-white/5 space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Calendar size={14} className="text-amber-500"/> Rango de Fechas a Exportar</label>
                        <div className="flex flex-wrap gap-2">
                            {(['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setReportRange(range)}
                                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border ${
                                        reportRange === range 
                                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20' 
                                            : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    {range === 'today' ? 'Hoy' : range === 'yesterday' ? 'Ayer' : range === 'last7' ? 'Últ. 7 Días' : range === 'thisMonth' ? 'Este Mes' : range === 'lastMonth' ? 'Mes Pasado' : 'Personalizado'}
                                </button>
                            ))}
                        </div>
                        {reportRange === 'custom' && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 pt-2">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Desde</label>
                                    <input 
                                        type="date" 
                                        value={customStartDate} 
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Hasta</label>
                                    <input 
                                        type="date" 
                                        value={customEndDate} 
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 bg-slate-900/50 px-3 py-2 rounded-xl border border-white/5 inline-flex items-center gap-2">
                                Datos del período: <span className="text-amber-400">{start.toLocaleDateString('es-AR')}</span> al <span className="text-amber-400">{end.toLocaleDateString('es-AR')}</span>
                            </p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="glass p-5 rounded-[1.5rem] border border-green-500/10 flex flex-col justify-between hover:bg-slate-900/50 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign size={12} className="text-green-500"/> Facturación</p>
                            <p className="text-xl font-black text-white font-mono tracking-tight">{formatARS(totalSales)}</p>
                        </div>
                        <div className="glass p-5 rounded-[1.5rem] border border-blue-500/10 flex flex-col justify-between hover:bg-slate-900/50 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Receipt size={12} className="text-blue-500"/> Pedidos</p>
                            <p className="text-xl font-black text-white font-mono tracking-tight">{orderCount}</p>
                        </div>
                        <div className="glass p-5 rounded-[1.5rem] border border-purple-500/10 flex flex-col justify-between hover:bg-slate-900/50 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Layers size={12} className="text-purple-500"/> Tkt. Promedio</p>
                            <p className="text-xl font-black text-white font-mono tracking-tight">{formatARS(avgTicket)}</p>
                        </div>
                        <div className="glass p-5 rounded-[1.5rem] border border-red-500/10 flex flex-col justify-between hover:bg-slate-900/50 transition-all">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-red-500"/> Costo Mermas</p>
                            <p className="text-xl font-black text-red-400 font-mono tracking-tight">-{formatARS(totalWaste)}</p>
                        </div>
                    </div>

                    {/* Descargas Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="glass p-6 rounded-[2rem] border border-white/5 space-y-5 hover:border-green-500/30 hover:bg-slate-900/50 transition-all group">
                            <div className="space-y-2">
                                <h4 className="font-black text-white text-[13px] flex items-center gap-2 uppercase tracking-wide"><DollarSign size={18} className="text-green-400"/> Libro de IVA Ventas</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-bold">Exporta el detalle de cada comanda cobrada en el período seleccionado. Ideal para entregar al contador y liquidar impuestos (IVA / Ingresos Brutos).</p>
                            </div>
                            <button onClick={handleExportSales} className="w-full py-4 bg-slate-800 group-hover:bg-green-600 group-hover:text-white text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Download size={14} /> Descargar CSV Excel
                            </button>
                        </div>

                        <div className="glass p-6 rounded-[2rem] border border-white/5 space-y-5 hover:border-yellow-500/30 hover:bg-slate-900/50 transition-all group">
                            <div className="space-y-2">
                                <h4 className="font-black text-white text-[13px] flex items-center gap-2 uppercase tracking-wide"><Star size={18} className="text-yellow-400"/> Ranking de Productos</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-bold">Descubre qué platos y bebidas rinden más. Ayuda a optimizar tu menú, analizar el mix de ventas y crear estrategias de marketing.</p>
                            </div>
                            <button onClick={handleExportProducts} className="w-full py-4 bg-slate-800 group-hover:bg-yellow-600 group-hover:text-slate-900 text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Download size={14} /> Descargar CSV Excel
                            </button>
                        </div>

                        <div className="glass p-6 rounded-[2rem] border border-white/5 space-y-5 hover:border-red-500/30 hover:bg-slate-900/50 transition-all group">
                            <div className="space-y-2">
                                <h4 className="font-black text-white text-[13px] flex items-center gap-2 uppercase tracking-wide"><AlertTriangle size={18} className="text-red-400"/> Auditoría de Mermas</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-bold">Controla las pérdidas de dinero ocultas en cocina por roturas, vencimientos o errores de preparación con sus costos exactos.</p>
                            </div>
                            <button onClick={handleExportWaste} className="w-full py-4 bg-slate-800 group-hover:bg-red-600 group-hover:text-white text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Download size={14} /> Descargar CSV Excel
                            </button>
                        </div>

                        <div className="glass p-6 rounded-[2rem] border border-white/5 space-y-5 hover:border-blue-500/30 hover:bg-slate-900/50 transition-all group">
                            <div className="space-y-2">
                                <h4 className="font-black text-white text-[13px] flex items-center gap-2 uppercase tracking-wide"><Wallet size={18} className="text-blue-400"/> Cierres de Caja (Historial)</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-bold">Audita el historial de cierres de caja diarios. Analiza el volumen de transacciones y los ingresos discriminados por efectivo vs medios digitales.</p>
                            </div>
                            <button onClick={handleExportBoxes} className="w-full py-4 bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Download size={14} /> Descargar CSV Excel
                            </button>
                        </div>
                    </div>
                </div>
                
                            ); })()}
                        </div>
                        {/* Accordion: Facturación AFIP */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'fiscal' ? null : 'fiscal')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    expandedConfigSection === 'fiscal' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">Facturación Fiscal (AFIP)</span>
                                </div>
                                {expandedConfigSection === 'fiscal' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'fiscal' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="px-2">
                        <h3 className="font-black uppercase italic text-sm">Configuración Fiscal / AFIP</h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Integra facturación electrónica en blanco de forma legal</p>
                    </div>

                    <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-5 relative overflow-hidden">
                        {/* Background Deco */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

                        <div className="relative z-10 space-y-6">
                            {/* Header switch */}
                            <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase flex items-center gap-2">
                                        <Receipt size={16} className={cfgAfipEnabled ? "text-blue-400" : "text-slate-500"} /> 
                                        Habilitar Módulo AFIP
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                                        Permitirá emitir facturas legales desde la caja
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={cfgAfipEnabled}
                                        onChange={(e) => setCfgAfipEnabled(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>

                            {cfgAfipEnabled && (
                                <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* CUIT */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-blue-400">CUIT del Local</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ej: 20346582201"
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                value={cfgAfipCuit}
                                                onChange={(e) => setCfgAfipCuit(e.target.value)}
                                            />
                                        </div>
                                        {/* Punto de Venta */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-blue-400">Punto de Venta</label>
                                            <input 
                                                type="number" 
                                                placeholder="Ej: 1"
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                value={cfgAfipPuntoVenta}
                                                onChange={(e) => setCfgAfipPuntoVenta(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Condicion IVA y Sandbox */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-blue-400">Condición frente al IVA</label>
                                            <select 
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                                                value={cfgAfipCondicionIva}
                                                onChange={(e) => setCfgAfipCondicionIva(e.target.value)}
                                            >
                                                <option value="Monotributista">Monotributista (Factura C)</option>
                                                <option value="Responsable Inscripto">Responsable Inscripto (Factura A y B)</option>
                                                <option value="Exento">Exento</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-blue-400">Entorno de Conexión</label>
                                            <select 
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none"
                                                value={cfgAfipIsSandbox ? 'sandbox' : 'production'}
                                                onChange={(e) => setCfgAfipIsSandbox(e.target.value === 'sandbox')}
                                            >
                                                <option value="sandbox">Pruebas (Homologación AFIP)</option>
                                                <option value="production">Producción (AFIP Real)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Certificados */}
                                    <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                                                <AlertCircle size={16} />
                                            </div>
                                            <div>
                                                <h5 className="text-[11px] font-black uppercase text-white">Certificados Digitales</h5>
                                                <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                                                    Si estás en modo desarrollo (local), el sistema usará los archivos "afip_certificado.crt" y "afip_privada.key" en la raíz del proyecto. Para producción, sube tus certificados oficiales aquí.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                            {/* Certificado CRT */}
                                            <div className="relative group cursor-pointer">
                                                <input 
                                                    type="file" 
                                                    accept=".crt,.txt" 
                                                    onChange={handleAfipCertUpload} 
                                                    disabled={isUploadingCert}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
                                                />
                                                <div className={`p-4 rounded-xl border border-dashed transition-all h-28 flex flex-col items-center justify-center text-center ${
                                                    isUploadingCert ? 'border-amber-500 bg-amber-950/20' :
                                                    cfgAfipCertPath ? 'border-green-500 bg-green-950/20' : 
                                                    'border-white/20 group-hover:border-blue-500 bg-slate-900'
                                                }`}>
                                                    {isUploadingCert ? (
                                                        <>
                                                            <Loader2 size={22} className="text-amber-400 animate-spin mb-2" />
                                                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Subiendo Certificado...</span>
                                                        </>
                                                    ) : cfgAfipCertPath ? (
                                                        <>
                                                            <CheckCircle size={22} className="text-green-400 mb-2 animate-bounce" />
                                                            <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">Certificado Subido Correctamente</span>
                                                            <span className="text-[9px] text-green-300/80 font-mono mt-1 break-all px-2 line-clamp-1">{cfgAfipCertPath}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={18} className="text-slate-400 group-hover:text-blue-400 mb-2 transition-transform group-hover:-translate-y-0.5" />
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase">Subir Certificado (.crt)</span>
                                                            <span className="text-[9px] text-slate-500 mt-1">Haz clic o arrastra el archivo</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Clave Privada KEY */}
                                            <div className="relative group cursor-pointer">
                                                <input 
                                                    type="file" 
                                                    accept=".key,.txt" 
                                                    onChange={handleAfipKeyUpload} 
                                                    disabled={isUploadingKey}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
                                                />
                                                <div className={`p-4 rounded-xl border border-dashed transition-all h-28 flex flex-col items-center justify-center text-center ${
                                                    isUploadingKey ? 'border-amber-500 bg-amber-950/20' :
                                                    cfgAfipKeyPath ? 'border-green-500 bg-green-950/20' : 
                                                    'border-white/20 group-hover:border-blue-500 bg-slate-900'
                                                }`}>
                                                    {isUploadingKey ? (
                                                        <>
                                                            <Loader2 size={22} className="text-amber-400 animate-spin mb-2" />
                                                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Subiendo Clave...</span>
                                                        </>
                                                    ) : cfgAfipKeyPath ? (
                                                        <>
                                                            <CheckCircle size={22} className="text-green-400 mb-2 animate-bounce" />
                                                            <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">Clave Privada Subida Correctamente</span>
                                                            <span className="text-[9px] text-green-300/80 font-mono mt-1 break-all px-2 line-clamp-1">{cfgAfipKeyPath}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={18} className="text-slate-400 group-hover:text-blue-400 mb-2 transition-transform group-hover:-translate-y-0.5" />
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase">Subir Clave Privada (.key)</span>
                                                            <span className="text-[9px] text-slate-500 mt-1">Haz clic o arrastra el archivo</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Guardar Botón */}
                            <button
                                onClick={handleSaveAfipConfig}
                                disabled={isSavingAfip}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSavingAfip ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Guardar Configuración AFIP
                            </button>
                        </div>
                    </div>
                </div>
                            )}
                        </div>
                        {/* Accordion: Club de Clientes */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'loyalty' ? null : 'loyalty')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    expandedConfigSection === 'loyalty' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">Club de Clientes / Fidelización</span>
                                </div>
                                {expandedConfigSection === 'loyalty' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
            {expandedConfigSection === 'loyalty' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="px-2 flex justify-between items-center flex-wrap gap-3">
                        <div>
                            <h3 className="font-black uppercase italic text-sm">Fidelización y Club de Clientes</h3>
                            <p className="text-slate-500 text-[10px] uppercase font-bold mt-1">Monitorea y premia a tus clientes más fieles con monedero virtual</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchLoyaltyAccounts}
                                className="py-2.5 px-4 bg-slate-900 border border-slate-800 text-[9px] font-black uppercase text-slate-400 rounded-xl hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <RefreshCw size={10} className={isFetchingLoyalty ? "animate-spin" : ""} /> Refrescar
                            </button>
                        </div>
                    </div>

                    {/* CONFIGURACIÓN DEL CLUB */}
                    <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3 text-left">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                    <Settings size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black text-white text-[12px] uppercase">Ajustes del Programa de Fidelidad</h4>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Controla cómo los clientes ganan y gastan su cashback</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${loyConfigEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {loyConfigEnabled ? 'Activo' : 'Inactivo'}
                                </span>
                                <input
                                    type="checkbox"
                                    checked={loyConfigEnabled}
                                    onChange={(e) => setLoyConfigEnabled(e.target.checked)}
                                    className="w-9 h-5 bg-slate-950 rounded-full appearance-none checked:bg-amber-500 border border-slate-800 cursor-pointer relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all checked:after:translate-x-4 checked:after:bg-white"
                                />
                            </div>
                        </div>

                        {loyConfigEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 space-y-2">
                                    <label className="text-[8.5px] font-black uppercase text-slate-500 block">Canal de Acumulación (Ganar)</label>
                                    <select
                                        value={loyConfigEarnChan}
                                        onChange={(e) => setLoyConfigEarnChan(e.target.value as any)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 font-bold"
                                    >
                                        <option value="both">Ambos (Online + Salón/Caja)</option>
                                        <option value="online">Solo Pedidos Online (PublicMenu)</option>
                                        <option value="salon">Solo Salón (Mesas/Caja)</option>
                                    </select>
                                    <p className="text-[7.5px] text-slate-500 font-bold leading-normal uppercase">Promueve un canal específico de venta permitiendo acumular saldo únicamente allí.</p>
                                </div>

                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 space-y-2">
                                    <label className="text-[8.5px] font-black uppercase text-slate-500 block">Canal de Canje (Gastar)</label>
                                    <select
                                        value={loyConfigRedeemChan}
                                        onChange={(e) => setLoyConfigRedeemChan(e.target.value as any)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 font-bold"
                                    >
                                        <option value="both">Ambos (Online + Salón/Caja)</option>
                                        <option value="online">Solo Pedidos Online (PublicMenu)</option>
                                        <option value="salon">Solo Salón (Mesas/Caja)</option>
                                    </select>
                                    <p className="text-[7.5px] text-slate-500 font-bold leading-normal uppercase">Decide en qué canales los clientes pueden descontar su dinero acumulado.</p>
                                </div>

                                <div className="bg-slate-950/40 p-4 rounded-3xl border border-white/5 space-y-2">
                                    <label className="text-[8.5px] font-black uppercase text-slate-500 block">Tasa de Cashback Base (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={loyConfigCashbackPct}
                                            onChange={(e) => setLoyConfigCashbackPct(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-amber-500/50 pr-8"
                                        />
                                        <span className="absolute right-3 top-2 text-[9px] font-black text-slate-500">%</span>
                                    </div>
                                    <p className="text-[7.5px] text-slate-500 font-bold leading-normal uppercase">Porcentaje de la compra que vuelve en pesos al monedero del cliente.</p>
                                </div>
                            </div>
                        )}

                        {/* CONFIGURACIÓN DE NIVELES (TIERS) */}
                        {loyConfigEnabled && (
                            <div className="space-y-4 text-left border-t border-white/5 pt-5">
                                <h5 className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5">
                                    <Trophy size={12} /> Configuración de Niveles y Beneficios del Club
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {loyConfigTiers.map((t, idx) => (
                                        <div key={t.name} className="bg-slate-950/30 border border-white/5 rounded-3xl p-5 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                    t.name === 'oro' ? 'bg-yellow-500/10 text-yellow-400' :
                                                    t.name === 'plata' ? 'bg-slate-300/10 text-slate-350' : 'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    ⭐ {t.name}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">Nivel {idx + 1}</span>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7.5px] font-black text-slate-500 uppercase block mb-1">Mín. Pedidos</label>
                                                        <input
                                                            type="number"
                                                            value={t.min_orders}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setLoyConfigTiers(prev => prev.map(item => item.name === t.name ? { ...item, min_orders: val } : item));
                                                            }}
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7.5px] font-black text-slate-500 uppercase block mb-1">Máx. Pedidos</label>
                                                        <input
                                                            type="number"
                                                            value={t.max_orders}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setLoyConfigTiers(prev => prev.map(item => item.name === t.name ? { ...item, max_orders: val } : item));
                                                            }}
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono font-bold"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[7.5px] font-black text-slate-500 uppercase block mb-1">Cashback %</label>
                                                        <input
                                                            type="number"
                                                            value={t.cashback_pct}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setLoyConfigTiers(prev => prev.map(item => item.name === t.name ? { ...item, cashback_pct: val } : item));
                                                            }}
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[7.5px] font-black text-slate-500 uppercase block mb-1">Desc. Extra %</label>
                                                        <input
                                                            type="number"
                                                            value={t.discount_pct}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setLoyConfigTiers(prev => prev.map(item => item.name === t.name ? { ...item, discount_pct: val } : item));
                                                            }}
                                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end border-t border-white/5 pt-4">
                            <button
                                onClick={handleUpdateLoyaltyConfig}
                                disabled={isSavingLoyaltyConfig}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-[10px] font-black uppercase text-white rounded-xl active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                                style={{ backgroundColor: tenant?.theme_colors?.primary || '#f97316' }}
                            >
                                {isSavingLoyaltyConfig ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Guardar Cambios del Club
                            </button>
                        </div>
                    </div>

                    {/* ANALÍTICA DEL CLUB Y CRM */}
                    {loyConfigEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
                            <div className="glass p-5 rounded-[2.5rem] border border-white/5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                                    <Award size={22} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Miembros Registrados</p>
                                    <h3 className="text-xl font-black text-white font-mono">{loyaltyAccounts.length}</h3>
                                    <p className="text-[7px] text-slate-400 font-bold uppercase">Clientes identificados por móvil</p>
                                </div>
                            </div>

                            <div className="glass p-5 rounded-[2.5rem] border border-white/5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                    <Coins size={22} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Crédito en Circulación</p>
                                    <h3 className="text-xl font-black text-emerald-400 font-mono">
                                        {formatARS(loyaltyAccounts.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0))}
                                    </h3>
                                    <p className="text-[7px] text-slate-400 font-bold uppercase">Saldo total acumulado</p>
                                </div>
                            </div>

                            <div className="glass p-5 rounded-[2.5rem] border border-white/5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                                    <TrendingUp size={22} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Ticket Promedio General</p>
                                    <h3 className="text-xl font-black text-blue-400 font-mono">
                                        {(() => {
                                            const validSpent = loyaltyAccounts.filter(a => a.total_orders > 0);
                                            if (validSpent.length === 0) return '$0';
                                            const totalOrders = validSpent.reduce((sum, item) => sum + item.total_orders, 0);
                                            const totalSpent = validSpent.reduce((sum, item) => sum + (parseFloat(item.total_spent) || 0), 0);
                                            return formatARS(Math.round(totalSpent / totalOrders));
                                        })()}
                                    </h3>
                                    <p className="text-[7px] text-slate-400 font-bold uppercase">Consumo por visita</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BUSCADOR Y TABLA CRM */}
                    {loyConfigEnabled && (
                        <div className="glass p-6 rounded-[2.5rem] border border-white/5 space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center text-left">
                                <div>
                                    <h4 className="font-black text-white text-[12px] uppercase">Base de Datos de Clientes y Trazabilidad</h4>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">Audita consumos, rankings y reactiva clientes inactivos</p>
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                                    {/* Buscador */}
                                    <div className="relative flex-1 sm:w-60">
                                        <Search size={12} className="absolute left-3.5 top-3 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por teléfono o nombre..."
                                            value={loyaltySearch}
                                            onChange={(e) => setLoyaltySearch(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-amber-500/50 font-bold"
                                        />
                                    </div>
                                    {/* Filtro Tier */}
                                    <select
                                        value={selectedLoyaltyTier}
                                        onChange={(e) => setSelectedLoyaltyTier(e.target.value as any)}
                                        className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 outline-none font-bold cursor-pointer"
                                    >
                                        <option value="all">Todos los Niveles</option>
                                        <option value="bronce">⭐ Bronce</option>
                                        <option value="plata">⭐ Plata</option>
                                        <option value="oro">⭐ Oro</option>
                                        <option value="dormant">💤 Inactivos ({'>'}30 días)</option>
                                    </select>
                                </div>
                            </div>

                            {/* TABLA CRM */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-slate-500 uppercase tracking-widest text-[8px] font-black">
                                            <th className="py-3 px-4">Cliente</th>
                                            <th className="py-3 px-4">Nivel</th>
                                            <th className="py-3 px-4 text-center">Pedidos</th>
                                            <th className="py-3 px-4 text-right">Ticket Promedio</th>
                                            <th className="py-3 px-4 text-right">Total Consumido</th>
                                            <th className="py-3 px-4 text-right">Saldo Monedero</th>
                                            <th className="py-3 px-4 text-center">Última Compra</th>
                                            <th className="py-3 px-4 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(() => {
                                            const filtered = loyaltyAccounts.filter(acc => {
                                                // Búsqueda de texto
                                                if (loyaltySearch) {
                                                    const q = loyaltySearch.toLowerCase();
                                                    const name = (acc.client_name || '').toLowerCase();
                                                    const phone = acc.phone_number || '';
                                                    if (!name.includes(q) && !phone.includes(q)) return false;
                                                }
                                                // Filtro de Nivel o Inactividad
                                                if (selectedLoyaltyTier === 'dormant') {
                                                    const diff = Date.now() - new Date(acc.last_order_date).getTime();
                                                    return diff > 30 * 24 * 60 * 60 * 1000;
                                                } else if (selectedLoyaltyTier !== 'all') {
                                                    return acc.tier === selectedLoyaltyTier;
                                                }
                                                return true;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={8} className="py-8 text-center text-slate-500 font-bold uppercase tracking-wider">
                                                            No se encontraron clientes que coincidan con la búsqueda.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filtered.map((acc, index) => {
                                                const ticketPromedio = acc.total_orders > 0 
                                                    ? Math.round(parseFloat(acc.total_spent) / acc.total_orders) 
                                                    : 0;

                                                const lastDate = new Date(acc.last_order_date);
                                                const diffDays = Math.floor((Date.now() - lastDate.getTime()) / 1000 / 60 / 60 / 24);
                                                const isClientDormant = diffDays > 30;

                                                // Mensaje personalizado de WhatsApp de fidelización / reactivación
                                                let waMessage = `¡Hola ${acc.client_name || 'Cliente'}! Te escribimos de ${tenant?.name || 'nuestro local'}. Queremos agradecerte por ser parte de nuestro Club.`;
                                                if (isClientDormant) {
                                                    waMessage = `¡Hola ${acc.client_name || 'Cliente'}! Te extrañamos en ${tenant?.name || 'nuestro local'}. Hace más de ${diffDays} días que no nos visitas. Por eso te regalamos un 10% de descuento en tu próxima compra online ingresando tu celular. ¡Te esperamos!`;
                                                } else if (acc.tier === 'oro') {
                                                    waMessage = `¡Hola ${acc.client_name || 'Cliente'}! Como miembro ORO de ${tenant?.name || 'nuestro local'}, te recordamos que tenés $[Saldo] de saldo en tu monedero virtual listos para usar, además de tu 5% de descuento automático en salón.`;
                                                }

                                                waMessage = waMessage.replace('[Saldo]', formatARS(parseFloat(acc.balance) || 0));

                                                return (
                                                    <tr key={acc.id} className="hover:bg-slate-900/30 transition-all font-bold">
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-white text-xs leading-tight">{acc.client_name || 'Sin Nombre'}</span>
                                                                <span className="text-slate-500 text-[8.5px] mt-0.5 font-mono">📱 {acc.phone_number}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 align-middle">
                                                            <span className={`text-[7px] uppercase font-black px-2 py-0.5 rounded-full ${
                                                                acc.tier === 'oro' ? 'bg-yellow-500/10 text-yellow-400' :
                                                                acc.tier === 'plata' ? 'bg-slate-300/10 text-slate-350' : 'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                                {acc.tier}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center text-slate-300 font-mono">{acc.total_orders}</td>
                                                        <td className="py-3.5 px-4 text-right text-slate-300 font-mono">{formatARS(ticketPromedio)}</td>
                                                        <td className="py-3.5 px-4 text-right text-slate-400 font-mono">{formatARS(parseFloat(acc.total_spent) || 0)}</td>
                                                        <td className="py-3.5 px-4 text-right text-emerald-400 font-mono font-black">{formatARS(parseFloat(acc.balance) || 0)}</td>
                                                        <td className="py-3.5 px-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-slate-300 text-[9px] font-mono">
                                                                    {lastDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                                </span>
                                                                <span className={`text-[6.5px] font-black uppercase mt-0.5 ${isClientDormant ? 'text-red-500' : 'text-slate-500'}`}>
                                                                    {isClientDormant ? `💤 Inactivo hace ${diffDays}d` : `Hace ${diffDays}d`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4">
                                                            <div className="flex gap-1.5 justify-center items-center">
                                                                {/* WhatsApp Link */}
                                                                <a
                                                                    href={`https://wa.me/${acc.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Contactar o Reactivar por WhatsApp"
                                                                    className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                                                                        isClientDormant
                                                                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 hover:scale-105'
                                                                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:scale-105'
                                                                    }`}
                                                                >
                                                                    <MessageCircle size={11} />
                                                                </a>
                                                                {/* Manual Adjustment */}
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingLoyaltyAccount(acc);
                                                                        setNewBalance(String(acc.balance));
                                                                    }}
                                                                    title="Ajustar Saldo Manualmente"
                                                                    className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                                                                >
                                                                    <Edit size={11} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
                        </div>


                        {/* Accordion: Fiados */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'fiados' ? null : 'fiados')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    expandedConfigSection === 'fiados' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">Gestión de Fiados</span>
                                </div>
                                {expandedConfigSection === 'fiados' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            {expandedConfigSection === 'fiados' && tenant && (
                                <div className="glass p-6 rounded-[2.5rem] border border-white/5 animate-in slide-in-from-top-2">
                                    <AdminFiadosTab tenantId={tenant.id} />
                                </div>
                            )}
                        </div>

                        {/* Accordion: Suscripción y Planes */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => setExpandedConfigSection(prev => prev === 'subscription' ? null : 'subscription')}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    expandedConfigSection === 'subscription' ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-slate-900/80 border-amber-500/30 text-amber-400'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5" />
                                    <span className="font-bold uppercase text-sm tracking-wider">Suscripción y Planes</span>
                                </div>
                                {expandedConfigSection === 'subscription' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
            {expandedConfigSection === 'subscription' && tenant && (
                <AdminSaasTab tenantId={tenant.id} />
            )}
                        </div>
                        {/* Save Button */}
                        <button
                            onClick={handleSaveConfig}
                            disabled={isSavingConfig}
                            className="w-full py-4 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
                            style={{ backgroundColor: tenant?.theme_colors?.primary || '#f97316' }}
                        >
                            {isSavingConfig ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                'Guardar Cambios'
                            )}
                        </button>


                </div>
            )}

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-red-500">
                                {editingExpenseId ? 'Editar Gasto' : 'Nuevo Gasto'}
                            </h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Descripción</label>
                                <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Pago de Luz" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Monto (ARS $)</label>
                                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Categoría</label>
                                <select
                                    value={expType}
                                    onChange={e => setExpType(e.target.value as Expense['type'])}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none appearance-none"
                                >
                                    <option value="purchase">Insumos / Materiales</option>
                                    <option value="salary">Nómina / Sueldos (Empleados)</option>
                                    <option value="rent">Alquiler / Local</option>
                                    <option value="service">Servicios (Luz, Agua, etc)</option>
                                    <option value="tax">Impuestos</option>
                                    <option value="waste">Descarte / Merma 📉</option>
                                    <option value="other">Otros Gastos</option>
                                </select>
                            </div>
                            <button onClick={handleSaveExpense} className="w-full py-5 bg-red-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest">
                                {editingExpenseId ? 'Actualizar Gasto' : 'Registrar Gasto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-amber-500">Categoría</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre</label>
                                <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Almacén" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Selecciona un Icono</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {NEON_ICONS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCatIcon(item.icon)}
                                            className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all border ${catIcon === item.icon ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-slate-900 border-slate-800'}`}
                                        >
                                            <span className="neon-icon">{item.icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Configuración Especial:</label>
                                <button
                                    type="button"
                                    onClick={() => setCatIsOffer(!catIsOffer)}
                                    className={`w-full py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                                        catIsOffer
                                            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/5'
                                            : 'bg-slate-950/20 border-slate-900 text-slate-600 hover:text-slate-500'
                                    }`}
                                >
                                    <Star size={12} className={catIsOffer ? 'fill-amber-500' : ''} />
                                    {catIsOffer ? 'Destacado como Oferta 🔥' : 'Marcar como Oferta'}
                                </button>
                            </div>
                            
                            {/* Imagen de Categoría */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Imagen de Portada (Opcional)</label>
                                <div className="flex items-center gap-3">
                                    {catImageUrl ? (
                                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-slate-900 relative group">
                                            <img src={catImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                            <button 
                                                type="button" 
                                                onClick={() => setCatImageUrl('')}
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 text-[8px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl border border-dashed border-slate-800 flex items-center justify-center shrink-0 text-slate-600 bg-slate-900 text-[9px] font-bold uppercase">
                                            Sin Foto
                                        </div>
                                    )}
                                    <label className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-850 text-neutral-300 font-bold rounded-xl text-center cursor-pointer text-[10px] uppercase border border-slate-800 active:scale-95 transition-all">
                                        Subir Imagen 🖼️
                                        <input type="file" accept="image/*" className="hidden" onChange={handleCategoryIconUpload} />
                                    </label>
                                </div>
                            </div>

                            <button onClick={handleSaveCategory} className="w-full py-5 bg-amber-500 text-white font-black rounded-2xl shadow-[0_10px_25px_-5px_rgba(249,115,22,0.4)] uppercase tracking-widest active:scale-95 transition-all">
                                {editingCategoryId ? 'Guardar Cambios' : 'Crear Categoría'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Crear Oferta Programada con Calculadora Interactiva de Rentabilidad */}
            {isOfferModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-md rounded-[2.5rem] p-6 space-y-5 shadow-2xl border border-white/10 my-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-base font-black uppercase italic text-purple-400 flex items-center gap-1.5">
                                <Star size={18} className="fill-purple-400 text-purple-400" />
                                Nueva Oferta Programada
                            </h3>
                            <button onClick={() => setIsOfferModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSaveOffer} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                            
                            {/* Descuento y Cantidad Límite */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Descuento (%)</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="100" 
                                        value={offDiscount} 
                                        onChange={e => setOffDiscount(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-white font-bold outline-none focus:border-purple-500/50 text-xs" 
                                        placeholder="Ej: 20" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Límite Cantidad (Opcional)</label>
                                    <input 
                                        type="number" 
                                        value={offLimitQty} 
                                        onChange={e => setOffLimitQty(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-white font-bold outline-none focus:border-purple-500/50 text-xs" 
                                        placeholder="Sin límite" 
                                    />
                                </div>
                            </div>

                            {/* Rango de Fechas */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Fecha Inicio</label>
                                    <input 
                                        type="date" 
                                        value={offStartDate} 
                                        onChange={e => setOffStartDate(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-white font-bold outline-none focus:border-purple-500/50 text-xs" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Fecha Fin</label>
                                    <input 
                                        type="date" 
                                        value={offEndDate} 
                                        onChange={e => setOffEndDate(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-white font-bold outline-none focus:border-purple-500/50 text-xs" 
                                        required 
                                    />
                                </div>
                            </div>

                            {/* Selección de Productos Participantes */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-500 ml-2 block">Seleccionar Productos del Menú</label>
                                <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 max-h-[160px] overflow-y-auto space-y-2 custom-scrollbar">
                                    {products.filter(prod => {
                                        if (prod.is_active === false) return false;
                                        // Filtro de Huérfanos: Solo mostrar productos cuya categoría EXISTA actualmente en la lista
                                        return categories.some(cat => cat.id === prod.category_id);
                                    }).map(prod => {
                                        const isSelected = offSelectedProducts.includes(prod.id);
                                        return (
                                            <div 
                                                key={prod.id} 
                                                onClick={() => {
                                                    setOffSelectedProducts(prev => 
                                                        prev.includes(prod.id) ? prev.filter(id => id !== prod.id) : [...prev, prod.id]
                                                    );
                                                }}
                                                className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                                                    isSelected ? 'bg-purple-600/10 border border-purple-500/20' : 'hover:bg-slate-900 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
                                                        isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700'
                                                    }`}>
                                                        {isSelected && <Check size={10} strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-300">{prod.name}</span>
                                                </div>
                                                <span className="text-[9px] text-slate-500 font-mono font-bold">{formatARS(prod.price)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Calculadora en Tiempo Real (Margen de Oferta) */}
                            {offSelectedProducts.length > 0 && (
                                <div className="glass p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
                                    <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1">
                                        <PieChart size={10} />
                                        Simulador de Margen de Oferta
                                    </p>
                                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                                        {offSelectedProducts.map(pid => {
                                            const prod = products.find(p => p.id === pid);
                                            if (!prod) return null;

                                            // Calcular costo de receta
                                            const recipeIngredients = productIngredients.filter(pi => pi.product_id === prod.id);
                                            const costTotal = recipeIngredients.reduce((sum, pi) => {
                                                const ing = ingredients.find(i => i.id === pi.ingredient_id);
                                                return sum + (pi.quantity_used * (ing?.unit_price || 0));
                                            }, 0);

                                            // Calcular nuevo precio con el descuento de la oferta
                                            const discPercent = parseFloat(offDiscount) || 0;
                                            const priceOffer = prod.price * (1 - discPercent / 100);
                                            const newProfit = priceOffer - costTotal;
                                            const newMargin = priceOffer > 0 ? (newProfit / priceOffer) * 100 : 0;

                                            const marginColor = newMargin <= 20 ? 'text-red-500' : newMargin <= 50 ? 'text-amber-500' : 'text-green-500';

                                            return (
                                                <div key={prod.id} className="bg-slate-950/50 p-2.5 rounded-xl border border-white/5 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-black text-white">{prod.name}</span>
                                                        <span className="text-[9px] font-mono text-purple-300 font-bold">
                                                            {formatARS(prod.price)} → <span className="font-black">{formatARS(priceOffer)}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500">
                                                        <span>Costo Receta: {formatARS(costTotal)}</span>
                                                        <span className={marginColor}>
                                                            Ganancia: {formatARS(newProfit)} • Margen: {newMargin.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSavingOffer}
                                className="w-full py-4.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                {isSavingOffer ? (
                                    <>
                                        <Loader2 className="animate-spin" size={14} />
                                        Programando Oferta...
                                    </>
                                ) : (
                                    'Programar Oferta Activa'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Modal (Insumos) */}
            {isStockModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-amber-500">
                                {editingStockId ? 'Editar Insumo' : 'Nuevo Insumo'}
                            </h3>
                            <button onClick={() => setIsStockModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre del Insumo</label>
                                <input type="text" value={stkName} onChange={e => setStkName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Pan Focaccia" />
                            </div>

                            <div className="space-y-1">
                                <label className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl cursor-pointer">
                                    <input type="checkbox" checked={stkIsFractionable} onChange={e => {
                                        setStkIsFractionable(e.target.checked);
                                        if (e.target.checked) setStkUnit('kg'); // Auto default to kg
                                    }} className="w-5 h-5 accent-amber-500" />
                                    <div>
                                        <span className="text-white font-bold text-sm block">Venta por Peso / Fraccionable</span>
                                        <span className="text-xs text-slate-400">Ej: Compro por kilo, uso gramos</span>
                                    </div>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">
                                        {stkIsFractionable ? `Precio Costo por ${stkUnit.toLowerCase().includes('l') ? 'Litro' : 'Kilo'} ($)` : 'Precio Costo ($)'}
                                    </label>
                                    <input type="number" value={stkPrice} onChange={e => setStkPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0.00" />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Código de Barras</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={stkBarcode} onChange={e => setStkBarcode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500" placeholder="Opcional. Escanea o escribe" />
                                        <button 
                                            type="button"
                                            onClick={() => setShowScanner(true)}
                                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-4 rounded-2xl flex items-center justify-center transition-colors"
                                            title="Escanear con Cámara"
                                        >
                                            <Barcode size={24} />
                                        </button>
                                    </div>
                                </div>
                                {editingStockId ? (
                                    <div className="space-y-3 p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-bold uppercase text-[9px]">Stock Actual:</span>
                                            <span className="text-white font-black">{ingredients.find(i => i.id === editingStockId)?.stock_level} {stkUnit}</span>
                                        </div>
                                        
                                        {/* Selector de Modo */}
                                        <div className="flex gap-2 p-1 bg-slate-950 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setStockUpdateMode('add')}
                                                className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${stockUpdateMode === 'add' ? 'bg-amber-500 text-white shadow' : 'text-slate-500'}`}
                                            >
                                                ➕ Agregar Stock
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStockUpdateMode('set')}
                                                className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${stockUpdateMode === 'set' ? 'bg-slate-900 border border-white/5 text-white' : 'text-slate-500'}`}
                                            >
                                                ⚙️ Ajustar Total
                                            </button>
                                        </div>
                                        {/* Input dinámico según modo */}
                                        {stockUpdateMode === 'add' ? (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Cantidad a Agregar</label>
                                                <input type="number" value={stkQtyToAdd} onChange={e => setStkQtyToAdd(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white font-bold outline-none" placeholder="Ej: +40" />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nuevo Stock Total</label>
                                                <input type="number" value={stkLevel} onChange={e => setStkLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white font-bold outline-none" placeholder="Ej: 60" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Si es nuevo insumo, mostrar el input de Stock Inicial clásico */
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500 ml-2">
                                            {stkIsFractionable ? `Stock Inicial (en ${stkUnit || 'kg'})` : 'Stock Inicial'}
                                        </label>
                                        <input type="number" value={stkLevel} onChange={e => setStkLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Unidad (uds, kg, l)</label>
                                    <input type="text" value={stkUnit} onChange={e => setStkUnit(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder={stkIsFractionable ? 'kg' : 'uds'} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">
                                        {stkIsFractionable ? `Alerta en (nivel en ${stkUnit || 'kg'})` : 'Alerta en (nivel)'}
                                    </label>
                                    <input type="number" value={stkMinAlert} onChange={e => setStkMinAlert(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder={stkIsFractionable ? "ej: 2" : "10"} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 flex items-center gap-1.5">
                                    <CalendarRange size={12} className="text-amber-500" />
                                    Fecha de Vencimiento (Lote Nuevo)
                                </label>
                                <input
                                    type="date"
                                    value={stkExpirationDate}
                                    onChange={e => setStkExpirationDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all text-xs"
                                />
                                <span className="text-[7.5px] font-bold text-slate-600 uppercase ml-2 block leading-none">
                                    Opcional • Dejar vacío si el insumo no vence
                                </span>
                            </div>

                            {/* Campo de Motivo si se reduce Stock (Merma/Descarte) */}
                            {editingStockId && parseFloat(stkLevel || '0') < (ingredients.find(i => i.id === editingStockId)?.stock_level || 0) && (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-2 animate-in slide-in-from-top-4">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                                        <AlertTriangle size={12} className="text-red-500 animate-pulse" />
                                        Stock Reducido: Registrar Merma
                                    </p>
                                    <p className="text-[8.5px] text-slate-400 font-bold leading-normal">
                                        Estás reduciendo el stock de {(ingredients.find(i => i.id === editingStockId)?.stock_level || 0).toFixed(1)} a {parseFloat(stkLevel || '0').toFixed(1)} {stkUnit}. Esta diferencia se registrará automáticamente como un gasto por merma en el balance.
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Motivo del Descarte</label>
                                        <select
                                            value={wasteReason}
                                            onChange={e => setWasteReason(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold outline-none"
                                        >
                                            <option value="Vencido">Vencido</option>
                                            <option value="Error de Cocina">Error de Cocina</option>
                                            <option value="Consumo de Personal">Consumo de Personal</option>
                                            <option value="Rotura">Rotura / Accidente</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <button onClick={handleSaveStock} className="w-full py-5 bg-amber-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest mt-2">
                                {editingStockId ? 'Actualizar Insumo' : 'Crear Insumo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Escáner de Código de Barras */}
            {showScanner && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] relative shadow-2xl">
                        <button 
                            onClick={() => setShowScanner(false)} 
                            className="absolute -top-4 -right-4 bg-red-500 text-white p-3 rounded-full shadow-xl hover:bg-red-400 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <div className="flex flex-col items-center mb-6">
                            <div className="bg-amber-500/10 p-3 rounded-full mb-3">
                                <Camera size={28} className="text-amber-500" />
                            </div>
                            <h3 className="text-white font-black text-center uppercase tracking-wider">Escanea el Código</h3>
                            <p className="text-slate-400 text-xs mt-1 text-center">Enfoca el código de barras con la cámara</p>
                        </div>
                        {/* Contenedor para Html5QrcodeScanner */}
                        <div id="reader" className="w-full rounded-2xl overflow-hidden bg-black text-white border border-slate-800 shadow-inner"></div>
                    </div>
                </div>
            )}

            {/* Waste Modal (Registrar Merma / Descarte) */}
            {isWasteModalOpen && selectedWasteIngredient && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/10">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-red-500 flex items-center gap-2">
                                <AlertTriangle className="animate-pulse" size={20} />
                                Registrar Merma
                            </h3>
                            <button onClick={() => { setIsWasteModalOpen(false); setSelectedWasteIngredient(null); }} className="text-slate-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-slate-950/40 p-4.5 rounded-2xl border border-white/5 space-y-1">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block leading-none">Insumo Seleccionado</span>
                                <span className="text-sm font-black text-white">{selectedWasteIngredient.name}</span>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                    <span>Stock Actual: {selectedWasteIngredient.stock_level.toFixed(1)} {selectedWasteIngredient.unit}</span>
                                    <span>Costo Unitario: {formatARS(selectedWasteIngredient.unit_price)}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Cantidad a Descartar</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={wasteQty} 
                                        onChange={e => setWasteQty(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-red-500/50 transition-all placeholder:text-slate-700 text-xs" 
                                        placeholder="0.0" 
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase">{selectedWasteIngredient.unit}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Motivo del Descarte</label>
                                <select
                                    value={wasteReason}
                                    onChange={e => setWasteReason(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-bold outline-none focus:border-red-500/50 transition-all"
                                >
                                    <option value="Vencido">Vencido</option>
                                    <option value="Error de Cocina">Error de Cocina</option>
                                    <option value="Consumo de Personal">Consumo de Personal</option>
                                    <option value="Rotura">Rotura / Accidente</option>
                                </select>
                            </div>

                            {/* Vista Previa de Pérdida en Dinero */}
                            {(() => {
                                const qty = parseFloat(wasteQty) || 0;
                                if (qty <= 0) return null;
                                const loss = qty * selectedWasteIngredient.unit_price;
                                return (
                                    <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-2xl flex justify-between items-center text-xs animate-in slide-in-from-top-2">
                                        <span className="font-bold text-red-400">Pérdida Estimada:</span>
                                        <span className="font-black text-red-500 font-mono">-{formatARS(loss)}</span>
                                    </div>
                                );
                            })()}

                            <button 
                                onClick={handleSaveWaste} 
                                disabled={isSavingWaste}
                                className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest mt-2 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                {isSavingWaste ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Registrando Merma...
                                    </>
                                ) : (
                                    'Confirmar Descarte'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto pt-10 pb-10">
                    <div className="glass w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl border border-white/10 my-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase italic text-amber-500">Nuevo Producto</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-slate-500"><X /></button>
                        </div>

                        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Image Picker Section */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Imagen del Producto</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-500/50 flex-shrink-0">
                                        <img src={prodImage} className="w-full h-full object-cover" />
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 h-24 border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-white hover:border-amber-500 transition-all"
                                    >
                                        <Upload size={20} />
                                        <span className="text-[9px] font-black uppercase">Subir Imagen</span>
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {PRESET_IMAGES.map((img, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setProdImage(img.url)}
                                            className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${prodImage === img.url ? 'border-amber-500' : 'border-transparent'}`}
                                        >
                                            <img src={img.url} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Nombre del Producto</label>
                                    <input type="text" value={prodName} onChange={e => setProdName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Ej: Burger Triple" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Descripción (Opcional)</label>
                                    <textarea value={prodDesc} onChange={e => setProdDesc(e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-medium text-[11px] outline-none custom-scrollbar resize-none" placeholder="Ej: Hamburguesa con doble medallón, queso cheddar, bacon y salsa secreta."></textarea>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 text-blue-400">Pregunta Personalizada al Cliente (Opcional)</label>
                                    <textarea value={prodCustomQuestion} onChange={e => setProdCustomQuestion(e.target.value)} rows={2} className="w-full bg-slate-900 border border-blue-500/30 rounded-2xl p-4 text-white font-medium text-[11px] outline-none custom-scrollbar resize-none focus:border-blue-500 transition-colors" placeholder="Ej: ¿Qué tipo de cerveza querés en el combo? ¿Cómo prefieres tu hamburguesa? ¿Con qué aderezo?"></textarea>
                                </div>
                                {prodCustomQuestion.trim().length > 0 && (
                                    <label className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl cursor-pointer hover:bg-blue-500/20 transition-colors">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" checked={prodIsQuestionRequired} onChange={e => setProdIsQuestionRequired(e.target.checked)} className="sr-only" />
                                            <div className={`w-8 h-4 rounded-full transition-colors ${prodIsQuestionRequired ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                                            <div className={`absolute w-3 h-3 bg-white rounded-full top-0.5 transition-transform ${prodIsQuestionRequired ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white uppercase">¿Es Obligatorio Responder?</span>
                                    </label>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2">
                                        {prodSaleByWeight ? 'Precio Venta por Kilo (ARS $)' : 'Precio Venta (ARS $)'}
                                    </label>
                                    <input type="number" value={prodPrice} onChange={e => setProdPrice(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none" placeholder="0" />
                                </div>

                                {/* Nueva seccion: Venta por peso */}
                                <div className="space-y-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" checked={prodSaleByWeight} onChange={e => setProdSaleByWeight(e.target.checked)} className="sr-only" />
                                            <div className={`w-8 h-4 rounded-full transition-colors ${prodSaleByWeight ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                                            <div className={`absolute w-3 h-3 bg-white rounded-full top-0.5 transition-transform ${prodSaleByWeight ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white uppercase flex flex-col">
                                            Vender por Peso
                                            <span className="text-[8px] text-slate-400 normal-case font-medium">Ej: Fiambres, Panadería, Helados</span>
                                        </span>
                                    </label>
                                    

                                </div>

                                {/* Calculadora Financiera en Tiempo Real */}
                                {(() => {
                                    const parsedPrice = parseFloat(prodPrice) || 0;
                                    const costTotal = prodIngredients.reduce((sum, pi) => {
                                        const ing = ingredients.find(i => i.id === pi.ingredient_id);
                                        return sum + (pi.quantity_used * (ing?.unit_price || 0));
                                    }, 0);

                                    const profit = parsedPrice - costTotal;
                                    const marginPercent = parsedPrice > 0 ? (profit / parsedPrice) * 100 : 0;

                                    const marginColor = marginPercent <= 20 
                                        ? 'text-red-500 border-red-500/20 bg-red-500/5 shadow-red-500/5' 
                                        : marginPercent <= 50 
                                            ? 'text-amber-500 border-amber-500/20 bg-amber-500/5 shadow-amber-500/5' 
                                            : 'text-green-500 border-green-500/20 bg-green-500/5 shadow-green-500/5';

                                    return (
                                        <div className={`p-4 rounded-2xl border transition-all space-y-2.5 backdrop-blur-sm shadow-inner ${marginColor}`}>
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                                                <span className="opacity-75">Costo de Receta:</span>
                                                <span className="font-mono text-slate-400 font-black">{formatARS(costTotal)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                                                <span className="opacity-75">Ganancia Estimada:</span>
                                                <span className="font-mono font-black">{formatARS(profit)}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px] font-black uppercase tracking-wider">
                                                <span>Margen de Utilidad:</span>
                                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-white/5">{marginPercent.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 ml-2 block">Insumos Necesarios</label>
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {ingredients.map(inv => {
                                            const selected = prodIngredients.find(i => i.ingredient_id === inv.id);
                                            return (
                                                <div key={inv.id} className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${selected ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                                    <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleIngredient(inv.id)}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-amber-500 border-amber-500' : 'border-slate-700'}`}>
                                                            {selected && <Check size={10} className="text-white" />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white">{inv.name}</span>
                                                    </div>
                                                    {selected && (
                                                        <div className="flex items-center gap-2">
                                                            <input type="number" value={selected.quantity_used} onChange={(e) => updateIngredientQty(inv.id, parseFloat(e.target.value) || 0)} className="w-12 bg-slate-800 border border-slate-700 rounded-lg p-1 text-[10px] text-center text-white" />
                                                            <span className="text-[9px] text-slate-500 uppercase">{inv.unit}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveProduct} className="w-full py-5 bg-amber-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest sticky bottom-0">
                                {editingProductId ? 'Actualizar Producto' : 'Guardar Producto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalle de Ventas del Día Seleccionado (Calendario Anual) */}
            {selectedDaySales && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                    <div className="glass w-full max-w-lg rounded-[2.5rem] p-6 space-y-6 shadow-2xl border border-white/10 flex flex-col max-h-[85vh] overflow-hidden">
                        
                        {/* Cabecera de la Modal */}
                        <div className="flex justify-between items-center pb-3 border-b border-white/5">
                            <div>
                                <h3 className="text-lg font-black uppercase italic text-amber-500">Resumen Diario</h3>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{selectedDaySales.dayLabel}</p>
                            </div>
                            <button 
                                onClick={() => { setSelectedDaySales(null); setExpandedModalOrderId(null); }}
                                className="text-slate-500 p-2 hover:text-white transition-all bg-slate-900 rounded-full hover:bg-slate-800"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
                            {/* Tarjeta Principal del Total del Día */}
                            <div 
                                className="relative overflow-hidden p-5 rounded-3xl border border-white/10 shadow-lg flex flex-col justify-between"
                                style={{
                                    background: `linear-gradient(135deg, ${tenant?.theme_colors?.primary || '#f97316'} 0%, #7c2d12 100%)`
                                }}
                            >
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-200/80">Total del Día Seleccionado</p>
                                    <h2 className="text-2xl font-black text-white font-mono tracking-tight">{formatARS(selectedDayStats.total)}</h2>
                                </div>
                                <p className="text-[7px] font-black text-amber-100/50 uppercase mt-2">
                                    {selectedDaySales.orders.length} {selectedDaySales.orders.length === 1 ? 'Pedido Registrado' : 'Pedidos Registrados'}
                                </p>
                            </div>

                            {/* Grid de 3 Columnas del Desglose */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="glass p-3 rounded-2xl border border-green-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-green-500" />
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Efectivo</p>
                                    <p className="text-[10px] font-black text-white font-mono">{formatARS(selectedDayStats.efectivo)}</p>
                                </div>
                                <div className="glass p-3 rounded-2xl border border-amber-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-amber-500" />
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Apps (Plataformas)</p>
                                    <p className="text-[10px] font-black text-white font-mono">{formatARS((selectedDayStats as any).rappi + (selectedDayStats as any).pedidosya)}</p>
                                </div>
                                <div className="glass p-3 rounded-2xl border border-blue-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-blue-500" />
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Débito</p>
                                    <p className="text-[10px] font-black text-white font-mono">{formatARS(selectedDayStats.debito)}</p>
                                </div>
                                <div className="glass p-3 rounded-2xl border border-purple-500/10 bg-slate-950/40 relative overflow-hidden">
                                    <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-purple-500" />
                                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Crédito</p>
                                    <p className="text-[10px] font-black text-white font-mono">{formatARS(selectedDayStats.credito)}</p>
                                </div>
                            </div>

                            {/* Listado Detallado de Comandas del Día */}
                            <div className="space-y-2.5">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 pl-1.5">Comandas del Día</h4>
                                {selectedDaySales.orders.map(order => (
                                    <div key={order.id} className="glass p-3 rounded-2xl border border-white/5 flex flex-col gap-2.5 transition-all hover:border-white/10 bg-slate-950/20">
                                        <div 
                                            onClick={() => setExpandedModalOrderId(expandedModalOrderId === order.id ? null : order.id)}
                                            className="flex justify-between items-center cursor-pointer select-none"
                                        >
                                            <div>
                                                <p className="font-black text-sm">
                                                    <span className="text-amber-500 mr-1.5">#{order.order_number || '?'}</span>
                                                    {order.client_name}
                                                </p>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="font-black text-amber-500 font-mono text-xs">{formatARS(order.total_price)}</p>
                                                    <span className="text-[7px] font-black uppercase text-slate-600">Reabrir no disponible</span>
                                                </div>
                                                <ChevronRight 
                                                    size={12} 
                                                    className={`text-slate-500 transition-transform duration-300 ${expandedModalOrderId === order.id ? 'rotate-90 text-amber-500' : ''}`} 
                                                />
                                            </div>
                                        </div>

                                        {expandedModalOrderId === order.id && (
                                            <div className="pt-2 border-t border-white/5 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                                <div className="flex justify-between items-center pb-0.5 text-[7px] font-black uppercase tracking-wider text-slate-500">
                                                    <span>Productos</span>
                                                    <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[7px] text-slate-400">
                                                        {order.payment_method === 'efectivo' ? '💵 Efectivo' : order.payment_method === 'debito' ? '💳 Débito' : order.payment_method === 'credito' ? '💳 Crédito' : '💳 Pago Digital'}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {order.items?.map(item => {
                                                        const prod = products.find(p => p.id === item.product_id);
                                                        return (
                                                            <div key={item.id} className="flex justify-between items-start bg-slate-900/60 p-2 rounded-xl border border-white/5 text-[11px]">
                                                                <div className="space-y-0.5 text-left">
                                                                    <p className="font-bold text-slate-200">
                                                                        <span className="text-amber-500 font-black mr-1">{item.quantity}x</span> 
                                                                        {item.notes || prod?.name || 'Producto'}
                                                                        {item.notes && (
                                                                            <span className="text-[8px] text-slate-500 ml-1 font-bold italic lowercase">
                                                                                ({prod?.name})
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <span className="font-mono font-bold text-slate-400 text-[10px]">{formatARS(item.unit_price * item.quantity)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* MODAL DE AJUSTE MANUAL DE SALDO */}
            {editingLoyaltyAccount && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-6 space-y-6 shadow-2xl text-left animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                            <h3 className="font-black uppercase italic text-sm text-amber-500">Ajuste de Monedero Virtual</h3>
                            <button
                                onClick={() => { setEditingLoyaltyAccount(null); setNewBalance(''); }}
                                className="text-slate-500 hover:text-white transition-all bg-slate-950 p-2 rounded-full border border-white/5"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h4 className="font-extrabold text-white text-xs">{editingLoyaltyAccount.client_name || 'Cliente sin nombre'}</h4>
                                <p className="text-[9px] font-mono text-slate-500 mt-0.5">Móvil: {editingLoyaltyAccount.phone_number}</p>
                            </div>

                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                                <label className="text-[8.5px] font-black uppercase text-slate-500 block mb-1">Nivel actual</label>
                                <span className={`text-[7px] uppercase font-black px-2 py-0.5 rounded-full ${
                                    editingLoyaltyAccount.tier === 'oro' ? 'bg-yellow-500/10 text-yellow-400' :
                                    editingLoyaltyAccount.tier === 'plata' ? 'bg-slate-300/10 text-slate-350' : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                    {editingLoyaltyAccount.tier}
                                </span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase text-slate-500 block">Nuevo Saldo disponible (ARS)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs font-black text-slate-500">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={newBalance}
                                        onChange={(e) => setNewBalance(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-6 pr-4 py-2 text-xs text-white font-bold outline-none focus:border-amber-500/50"
                                    />
                                </div>
                                <p className="text-[7.5px] text-slate-500 font-bold uppercase leading-normal">Introduce el saldo total en pesos que deseas que tenga este monedero.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => handleAdjustBalanceManual(editingLoyaltyAccount.id, parseFloat(newBalance) || 0)}
                                className="flex-1 py-3 bg-amber-500 text-[10px] font-black uppercase text-white rounded-xl active:scale-95 transition-all shadow-md text-center"
                                style={{ backgroundColor: tenant?.theme_colors?.primary || '#f97316' }}
                            >
                                Actualizar Saldo
                            </button>
                            <button
                                onClick={() => { setEditingLoyaltyAccount(null); setNewBalance(''); }}
                                className="flex-1 py-3 bg-slate-850 hover:bg-slate-800 text-[10px] font-black uppercase text-slate-400 rounded-xl active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barra Flotante de Acciones Masivas */}
            {selectedProductIds.length > 0 && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-xl bg-slate-900/95 border border-amber-500/30 backdrop-blur-md p-4 rounded-3xl shadow-[0_10px_30px_rgba(249,115,22,0.15)] animate-in fade-in slide-in-from-top-6 duration-200">
                    <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Acciones Masivas</span>
                            <span className="text-[11px] font-bold text-white leading-tight">
                                {selectedProductIds.length} {selectedProductIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={bulkPercent}
                                    onChange={(e) => setBulkPercent(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-amber-500/50 w-20 text-center pr-5"
                                />
                                <span className="absolute right-2 text-[10px] font-black text-slate-500">%</span>
                            </div>
                            <button
                                onClick={handleBulkPriceUpdate}
                                disabled={isBulkUpdating || !bulkPercent}
                                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all flex items-center gap-1"
                            >
                                {isBulkUpdating ? 'Aplicando...' : 'Aplicar Aumento'}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedProductIds([]);
                                    setBulkPercent('');
                                }}
                                className="bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Hidden component for printing QR poster */}
            <PrintableQRPoster ref={qrPrintRef} tenant={tenant} />


            {tenant && <AdminSupportFloatingButton tenantId={tenant.id} />}

            {/* Modal para características bloqueadas (PLG / Upsell) */}
            {lockedFeatureModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass max-w-sm w-full p-8 rounded-[2rem] border border-white/10 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
                        
                        <div className="w-16 h-16 bg-purple-500/15 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Plus size={28} />
                        </div>

                        <h3 className="text-lg font-black text-white uppercase tracking-wide">Función Premium 🔒</h3>
                        <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                            {lockedFeatureModal === 'loyalty' && 'El Programa de Fidelización (Club de Clientes) con monedero virtual, cashback configurable y tiers Bronce/Plata/Oro está disponible de forma exclusiva en el Plan Pro Ilimitado.'}
                            {lockedFeatureModal === 'tables' && 'La Gestión Visual de Mesas y el Panel exclusivo de Mozos móvil está disponible a partir del Plan Avanzado.'}
                            {lockedFeatureModal === 'balance' && 'El Balance Financiero con contabilidad integrada, gráficos interactivos de pérdidas y ganancias y reportes de rentabilidad está disponible en el Plan Pro Ilimitado.'}
                            {lockedFeatureModal === 'reports' && 'La exportación avanzada de auditoría y reportes detallados en CSV está disponible en el Plan Pro Ilimitado.'}
                        </p>

                        <div className="mt-8 flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    setView('subscription');
                                    setLockedFeatureModal(null);
                                }}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                Ver Planes y Precios
                            </button>
                            <button
                                onClick={() => setLockedFeatureModal(null)}
                                className="w-full bg-white/5 hover:bg-white/10 active:scale-95 text-slate-400 font-bold uppercase tracking-wider py-3 rounded-xl transition-all"
                            >
                                Volver
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTab;

