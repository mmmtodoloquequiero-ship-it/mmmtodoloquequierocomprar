'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Navigation, Star, ArrowRight, ShieldCheck, Sparkles, AlertCircle, RefreshCw, X, ShoppingCart, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CartItem {
    id: string;
    name: string;
    price: number; // Precio con recargo
    originalPrice: number; // Precio original
    quantity: number;
}

export default function TestDeliveryPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [selectedTenant, setSelectedTenant] = useState('');
    const [tenantConfig, setTenantConfig] = useState<any>(null);
    const [platform, setPlatform] = useState<'rappi' | 'pedidosya'>('rappi');
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [productIngredients, setProductIngredients] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [log, setLog] = useState<string>('');
    const [showLogModal, setShowLogModal] = useState(false);
    const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

    // Cargar Tenants al inicio
    useEffect(() => {
        supabase.from('tenants').select('*').then(({ data }) => {
            if (data) {
                setTenants(data);
                if (data.length > 0) setSelectedTenant(data[0].id);
            }
        });
    }, []);

    // Cargar toda la información del tenant seleccionado para la sincronización de stock y precios
    const fetchTenantData = async (tenantId: string) => {
        if (!tenantId) return;

        // Crear un cliente con la cabecera del tenant para saltar las políticas de RLS correctamente
        const tenantSupabase = createClient(supabaseUrl, supabaseKey, {
            global: {
                headers: { 'x-tenant-id': tenantId }
            }
        });

        // 1. Obtener configuración del local
        const { data: tenantData } = await tenantSupabase.from('tenants').select('*').eq('id', tenantId).single();
        if (tenantData) setTenantConfig(tenantData);

        // 2. Obtener productos
        const { data: prodData } = await tenantSupabase.from('products').select('*').eq('tenant_id', tenantId);
        if (prodData) setProducts(prodData);

        // 3. Obtener categorías
        const { data: catData } = await tenantSupabase.from('categories').select('*').eq('tenant_id', tenantId);
        if (catData) setCategories(catData || []);

        // 4. Obtener insumos (ingredients)
        const { data: ingData } = await tenantSupabase.from('ingredients').select('*').eq('tenant_id', tenantId);
        if (ingData) setIngredients(ingData);

        // 5. Obtener recetas (product_ingredients)
        const { data: recData } = await tenantSupabase.from('product_ingredients').select('*').eq('tenant_id', tenantId);
        if (recData) setProductIngredients(recData);

        // 6. Obtener órdenes activas (para restar stock de comandas pendientes)
        const { data: ordData } = await tenantSupabase.from('orders').select('*, items:order_items(*)').eq('tenant_id', tenantId).eq('is_archived', false);
        if (ordData) setOrders(ordData);
    };

    useEffect(() => {
        fetchTenantData(selectedTenant);

        // Suscribirse a cambios en tiempo real en productos, ingredientes y recetas para que el simulador actualice stock al instante
        const channel = supabase
            .channel(`delivery-sync:${selectedTenant}`)
            .on('postgres_changes', { event: '*', schema: 'public', filter: `tenant_id=eq.${selectedTenant}` }, () => {
                fetchTenantData(selectedTenant);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedTenant]);

    // Lógica idéntica al PublicMenu.tsx para calcular stock disponible basado en ingredientes
    const getPendingUsage = (ingredientId: string) => {
        let usage = 0;
        const ingredient = ingredients.find(i => i.id === ingredientId);
        const ingDepts = ingredient?.target_departments || ['kitchen'];

        orders.forEach(order => {
            if (order.items) {
                order.items.forEach((item: any) => {
                    if (item.status === 'pending') {
                        const itemDepts = item.target_departments || ['kitchen'];
                        const hasDeptOverlap = ingDepts.some((d: string) => itemDepts.includes(d));

                        if (hasDeptOverlap) {
                            const recipe = productIngredients.filter(pi => pi.product_id === item.product_id);
                            const req = recipe.find(pi => pi.ingredient_id === ingredientId);
                            if (req) {
                                usage += req.quantity_used * item.quantity;
                            }
                        }
                    }
                });
            }
        });
        return usage;
    };

    const getAvailableStockForProduct = (productId: string, currentCart: CartItem[] = cart) => {
        const recipe = productIngredients.filter(pi => pi.product_id === productId);
        if (recipe.length === 0) return Infinity;

        const ingredientUsageInCart: Record<string, number> = {};
        currentCart.forEach(item => {
            const itemRecipe = productIngredients.filter(pi => pi.product_id === item.id);
            itemRecipe.forEach(req => {
                ingredientUsageInCart[req.ingredient_id] = (ingredientUsageInCart[req.ingredient_id] || 0) + (req.quantity_used * item.quantity);
            });
        });

        let maxPossible = Infinity;
        for (const req of recipe) {
            const ingredient = ingredients.find(i => i.id === req.ingredient_id);
            if (!ingredient) return 0;

            const usedAlready = ingredientUsageInCart[req.ingredient_id] || 0;
            const pendingUsed = getPendingUsage(req.ingredient_id);
            const remainingStock = ingredient.stock_level - usedAlready - pendingUsed;

            const canMake = Math.floor(remainingStock / req.quantity_used);
            if (canMake < maxPossible) maxPossible = canMake;
        }

        return Math.max(0, maxPossible);
    };

    // Calcular el precio inflado basado en el markup
    const getMarkedUpPrice = (basePrice: number) => {
        const markup = tenantConfig?.delivery_apps_markup || 0;
        return Math.round(basePrice * (1 + markup / 100));
    };

    // Agregar producto al carrito de Rappi
    const handleAddToCart = (product: any) => {
        const markedUpPrice = getMarkedUpPrice(product.price);
        const availableStock = getAvailableStockForProduct(product.id);

        if (availableStock <= 0) {
            alert('⚠️ ¡Ups! Rappi detectó que este producto no tiene stock en el local.');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { id: product.id, name: product.name, price: markedUpPrice, originalPrice: product.price, quantity: 1 }];
        });
    };

    const handleUpdateQuantity = (productId: string, delta: number) => {
        setCart(prev => {
            const item = prev.find(i => i.id === productId);
            if (!item) return prev;

            if (delta > 0) {
                const availableStock = getAvailableStockForProduct(productId);
                if (availableStock <= 0) {
                    alert('⚠️ No hay suficiente stock de insumos para sumar otra unidad.');
                    return prev;
                }
            }

            return prev.map(i => {
                if (i.id === productId) {
                    const newQ = i.quantity + delta;
                    return newQ > 0 ? { ...i, quantity: newQ } : i;
                }
                return i;
            }).filter(i => i.quantity > 0);
        });
    };

    const handleClearCart = () => setCart([]);

    // Totales del carrito
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const serviceFee = Math.round(subtotal * 0.1); // 10% tarifa de servicio Rappi
    const deliveryFee = subtotal > 0 ? 350 : 0; // Envío fijo
    const grandTotal = subtotal + serviceFee + deliveryFee;

    // Disparar Webhook realista a nuestro traductor universal de APIs
    const handleSendOrder = async () => {
        if (!selectedTenant || cart.length === 0) return;
        setIsSending(true);
        setSuccessOrderNumber(null);

        const externalId = `${platform.toUpperCase()}-${Math.floor(Math.random() * 900000 + 100000)}`;

        // JSON exacto y fiel al estándar JSON-LD/Payload que envía Rappi o PedidosYa en Producción
        const payload = {
            tenant_id: selectedTenant,
            platform: platform,
            external_id: externalId,
            delivery_apps_token: tenantConfig?.delivery_apps_token || '',
            store_id: platform === 'rappi' ? tenantConfig?.rappi_store_id : tenantConfig?.pedidosya_store_id,
            customer: {
                name: `Cliente de ${platform === 'rappi' ? 'Rappi' : 'PedidosYa'} (${['Gisela', 'Mariano', 'Facundo', 'Lucía'][Math.floor(Math.random() * 4)]})`,
                phone: '+54911' + Math.floor(Math.random() * 90000000 + 10000000)
            },
            items: cart.map(item => ({
                product_id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit_price: item.price // Mandamos el precio con recargo
            })),
            totals: {
                subtotal: subtotal,
                service_fee: serviceFee,
                delivery_fee: deliveryFee,
                grand_total: grandTotal
            },
            delivery_address: 'Av. Corrientes 1540, CABA',
            created_at: new Date().toISOString()
        };

        const jsonString = JSON.stringify(payload, null, 2);
        setLog(jsonString);

        try {
            const res = await fetch(`/api/webhooks/${platform}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonString
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error HTTP');

            setSuccessOrderNumber(externalId);
            setCart([]);
        } catch (err: any) {
            alert(`❌ Error al inyectar pedido: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    // Filtrar productos fantasmas o borrados del menú en el Rappi falso
    const activeProducts = useMemo(() => {
        return products.filter(p => {
            if (p.is_active === false) return false;
            const categoryExists = categories.some(c => c.id === p.category_id);
            return categoryExists;
        });
    }, [products, categories]);

    const isDeliveryAppsEnabled = tenantConfig?.delivery_apps_enabled;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8 font-sans">
            {/* Header del Simulador */}
            <div className="max-w-5xl w-full mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <Sparkles className="text-amber-500" />
                        Traductor de APIs & Simulador de Delivery
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Prueba la sincronización de stock y precios inflados usando la estructura JSON exacta de Rappi y PedidosYa.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {/* Selector de local */}
                    <div className="flex flex-col gap-1 w-full sm:w-48">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Restaurante a Testear</span>
                        <select
                            value={selectedTenant}
                            onChange={(e) => setSelectedTenant(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 font-semibold"
                        >
                            {tenants.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Marca/Branding de Plataforma */}
                    <div className="flex flex-col gap-1 w-full sm:w-48">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Plataforma</span>
                        <div className="grid grid-cols-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                            <button
                                onClick={() => setPlatform('rappi')}
                                className={`text-[10px] font-black rounded-lg py-2 transition-all ${
                                    platform === 'rappi' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                RAPPI
                            </button>
                            <button
                                onClick={() => setPlatform('pedidosya')}
                                className={`text-[10px] font-black rounded-lg py-2 transition-all ${
                                    platform === 'pedidosya' ? 'bg-red-600 text-white shadow-md shadow-red-600/25' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                PEDIDOSYA
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Si la integración de Apps está desactivada */}
            {!isDeliveryAppsEnabled ? (
                <div className="max-w-xl w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center justify-center my-12 animate-in fade-in duration-300">
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl mb-4 border border-red-500/20">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider mb-2">Integración de Plataformas Inactiva</h2>
                    <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                        El restaurante <strong className="text-white">"{tenantConfig?.name}"</strong> tiene desactivadas las plataformas externas. Actívalas en la pestaña de Administración (Configuración del Local) para simular.
                    </p>
                    <div className="text-[10px] uppercase font-bold text-slate-500 border border-slate-800 rounded-xl px-4 py-2 bg-slate-950">
                        Configuración Requerida: delivery_apps_enabled = true
                    </div>
                </div>
            ) : (
                /* Contenedor del Simulador (Celular Falso) */
                <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
                    
                    {/* CELULAR DE RAPPI/PEDIDOSYA CLONE (2 Columnas) */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden relative">
                        {/* Notch y Status Bar simulados */}
                        <div className="bg-black py-2.5 px-6 flex justify-between items-center text-[10px] font-bold text-slate-400">
                            <span>09:41</span>
                            <div className="w-20 h-4 bg-slate-950 border border-slate-900 rounded-full mx-auto hidden md:block"></div>
                            <div className="flex gap-1.5 items-center">
                                <span>5G</span>
                                <div className="w-4 h-2 bg-slate-400 rounded-sm"></div>
                            </div>
                        </div>

                        {/* Banner del Local en Rappi/PedidosYa */}
                        <div className={`relative h-44 flex flex-col justify-end p-6 bg-gradient-to-t ${
                            platform === 'rappi' ? 'from-amber-650/90 to-amber-500/30' : 'from-red-950/90 to-red-600/30'
                        }`}>
                            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-[9px] font-black tracking-widest text-white px-3 py-1 rounded-full uppercase border border-white/10">
                                {platform.toUpperCase()} PARTNER
                            </div>
                            <h2 className="text-2xl font-black text-white">{tenantConfig?.name}</h2>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-200">
                                <span className="flex items-center gap-1 font-bold">
                                    <Star className="fill-yellow-500 text-yellow-500" size={14} /> 4.8 (500+)
                                </span>
                                <span>•</span>
                                <span>20-30 min</span>
                                <span>•</span>
                                <span className="text-green-400 font-bold">Envío Gratis</span>
                            </div>
                        </div>

                        {/* Alerta de sincronización activa */}
                        <div className="bg-slate-950 border-y border-slate-800 px-6 py-2.5 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-black">
                                <ShieldCheck size={14} /> CATÁLOGO SINCRONIZADO
                            </span>
                            <span className="font-bold">
                                Recargo: <strong className="text-white">+{tenantConfig?.delivery_apps_markup}%</strong>
                            </span>
                        </div>

                        {/* Listado de Categorías y Productos */}
                        <div className="p-6 space-y-8 max-h-[600px] overflow-y-auto">
                            {categories.map(cat => {
                                const catProducts = activeProducts.filter(p => p.category_id === cat.id);
                                if (catProducts.length === 0) return null;

                                return (
                                    <div key={cat.id} className="space-y-4">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">{cat.name}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {catProducts.map(prod => {
                                                const stock = getAvailableStockForProduct(prod.id);
                                                const isSoldOut = stock <= 0;
                                                const isLowStock = stock > 0 && stock <= 2;
                                                const finalPrice = getMarkedUpPrice(prod.price);

                                                return (
                                                    <div 
                                                        key={prod.id} 
                                                        className={`bg-slate-950 border rounded-2xl p-4 flex justify-between gap-4 transition-all ${
                                                            isSoldOut ? 'border-slate-900 opacity-60' : 'border-slate-800/80 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col justify-between flex-1 space-y-2">
                                                            <div>
                                                                <h4 className="font-bold text-white text-xs">{prod.name}</h4>
                                                                <p className="text-[9px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{prod.description || 'Sin descripción'}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <div className="flex items-baseline gap-1.5">
                                                                        <span className="text-white text-sm font-black font-mono">${finalPrice}</span>
                                                                        {tenantConfig?.delivery_apps_markup > 0 && (
                                                                            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                                +{tenantConfig.delivery_apps_markup}% Markup
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">
                                                                        Precio Local (Base): <span className="line-through">${prod.price}</span>
                                                                    </span>
                                                                </div>
                                                                
                                                                {/* Indicadores de stock en tiempo real */}
                                                                {isSoldOut ? (
                                                                    <span className="text-[7.5px] bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase px-2 py-0.5 rounded-full inline-block">Sin Stock</span>
                                                                ) : isLowStock ? (
                                                                    <span className="text-[7.5px] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black uppercase px-2 py-0.5 rounded-full inline-block animate-pulse">¡Últimas {stock} unidades!</span>
                                                                ) : (
                                                                    <span className="text-[7.5px] text-slate-500 block uppercase font-bold">Disponible en local: {stock === Infinity ? 'Ilimitado' : stock}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Imagen y control de agregar */}
                                                        <div className="relative w-20 h-20 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-center overflow-hidden shrink-0">
                                                            {prod.image_url ? (
                                                                <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ShoppingBag size={24} className="text-slate-700" />
                                                            )}
                                                            
                                                            <button
                                                                disabled={isSoldOut}
                                                                onClick={() => handleAddToCart(prod)}
                                                                className={`absolute bottom-1 right-1 p-1.5 rounded-lg active:scale-95 transition-all shadow-md ${
                                                                    isSoldOut ? 'bg-slate-800 text-slate-600' :
                                                                    platform === 'rappi' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-red-650 hover:bg-red-500 text-white'
                                                                }`}
                                                            >
                                                                <span className="font-black text-xs px-1">+</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CARRITO Y CONSOLA DE EVENTOS (1 Columna) */}
                    <div className="space-y-6">
                        {/* Carrito de Compras */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><ShoppingCart size={14} /> Carrito de {platform === 'rappi' ? 'Rappi' : 'PedidosYa'}</span>
                                {cart.length > 0 && (
                                    <button onClick={handleClearCart} className="text-red-500 hover:text-red-400 text-[9px] uppercase font-bold flex items-center gap-0.5">
                                        <Trash2 size={10} /> Vaciar
                                    </button>
                                )}
                            </h3>

                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <ShoppingBag size={32} className="mx-auto text-slate-800 mb-2" />
                                    <p className="text-[10px] font-bold uppercase">Agrega productos del catálogo sincronizado</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Lista de productos seleccionados */}
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                        {cart.map(item => (
                                            <div key={item.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between text-xs gap-3">
                                                <div className="flex-1">
                                                    <h5 className="font-bold text-white text-[11px] leading-tight">{item.name}</h5>
                                                    <span className="text-[9px] text-slate-500 font-mono">${item.price} c/u</span>
                                                </div>
                                                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shrink-0">
                                                    <button onClick={() => handleUpdateQuantity(item.id, -1)} className="px-2 py-1 text-slate-400 hover:text-white font-bold">-</button>
                                                    <span className="px-2 py-1 font-mono text-[10px] text-white font-bold">{item.quantity}</span>
                                                    <button onClick={() => handleUpdateQuantity(item.id, 1)} className="px-2 py-1 text-slate-400 hover:text-white font-bold">+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desglose de Precios */}
                                    <div className="border-t border-slate-850 pt-4 space-y-2 text-[10px] text-slate-400 uppercase font-bold font-mono">
                                        <div className="flex justify-between">
                                            <span>Subtotal</span>
                                            <span className="text-white">${subtotal}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Servicio App (10%)</span>
                                            <span className="text-white">${serviceFee}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Envío</span>
                                            <span className="text-white">${deliveryFee}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-850 pt-2 text-xs font-black text-white">
                                            <span>TOTAL CLIENTE</span>
                                            <span style={{ color: platform === 'rappi' ? '#f97316' : '#dc2626' }}>${grandTotal}</span>
                                        </div>
                                    </div>

                                    {/* Botón de envío de Webhook */}
                                    <button
                                        disabled={isSending}
                                        onClick={handleSendOrder}
                                        className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${
                                            platform === 'rappi' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/10' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/10'
                                        }`}
                                    >
                                        {isSending ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={14} /> INYECTANDO EN EL SAAS...
                                            </>
                                        ) : (
                                            <>
                                                COMPRAR COMO CLIENTE <ArrowRight size={12} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mensaje de éxito de la orden */}
                        {successOrderNumber && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-5 rounded-3xl shadow-xl space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="shrink-0 mt-0.5" size={18} />
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-white">¡Pedido recibido con éxito!</h4>
                                        <p className="text-[10px] text-slate-400 leading-relaxed">
                                            El pedido <strong className="text-white">#{successOrderNumber}</strong> ha sido inyectado en el sistema usando el formato de datos oficial de {platform === 'rappi' ? 'Rappi' : 'PedidosYa'}.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowLogModal(true)}
                                        className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-[9px] uppercase font-black tracking-wider transition-all flex items-center gap-1"
                                    >
                                        📄 Ver JSON Enviado
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal para inspeccionar el JSON del payload de la API (Cumpliendo el deseo de ver qué se envía) */}
            {showLogModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-slate-950 border-b border-slate-850 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-white flex items-center gap-2">
                                    <ShieldCheck className="text-emerald-500" />
                                    Payload JSON Oficial de la API
                                </h3>
                                <p className="text-[9px] text-slate-500 uppercase font-semibold mt-0.5">Estructura real transmitida desde Rappi/PedidosYa</p>
                            </div>
                            <button onClick={() => setShowLogModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-black font-mono text-[10px] text-emerald-400">
                            <pre className="whitespace-pre-wrap break-all">{log}</pre>
                        </div>
                        <div className="px-6 py-4 bg-slate-950 border-t border-slate-850 flex justify-end">
                            <button
                                onClick={() => setShowLogModal(false)}
                                className="bg-slate-900 border border-slate-800 text-white font-black px-6 py-2.5 rounded-xl text-[10px] uppercase hover:bg-slate-850 active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
