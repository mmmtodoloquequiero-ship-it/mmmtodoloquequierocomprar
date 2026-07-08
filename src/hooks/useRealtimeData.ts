import { useEffect, useState } from 'react'
import { supabase, setSupabaseTenant } from '@/lib/supabase'
import { Category, Product, Ingredient, Order, Expense, ProductIngredient, AppNotification, IngredientBatch, ProductOffer } from '@/types/database'

export function useRealtimeData(tenantId: string | null, isPublic: boolean = false) {
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([])
    const [ingredientBatches, setIngredientBatches] = useState<IngredientBatch[]>([])
    const [productOffers, setProductOffers] = useState<ProductOffer[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const processOffers = (offers: ProductOffer[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Filtrar las ofertas activas hoy
        const activeOffers = offers.filter(offer => {
            const [y, m, d] = offer.end_date.split('T')[0].split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            return today <= end;
        });

        // 2. Ejecutar limpieza física asíncrona y silenciosa de las vencidas
        const expiredIds = offers.filter(offer => {
            const [y, m, d] = offer.end_date.split('T')[0].split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            return today > end;
        }).map(o => o.id);

        if (expiredIds.length > 0 && !isPublic) {
            console.log(`[OFFER AUTO-CLEANUP] Eliminando físicamente ${expiredIds.length} ofertas vencidas de la base de datos...`);
            supabase.from('product_offers').delete().in('id', expiredIds).then(({ error }) => {
                if (error) console.error("Error al eliminar ofertas expiradas:", error);
            });
        }

        setProductOffers(activeOffers);
    };

    const fetchData = async (isSilent: boolean = false, tableToFetch: string | null = null) => {
        if (!tenantId) return;
        if (!isSilent) setIsLoading(true);

        // 1. CARGA QUIRÚRGICA (Solo una tabla específica)
        if (tableToFetch) {
            try {
                switch (tableToFetch) {
                    case 'categories':
                        const { data: catData } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).order('created_at');
                        if (catData) {
                            setCategories(catData);
                            localStorage.setItem(`cache_categories_${tenantId}`, JSON.stringify(catData));
                        }
                        break;
                    case 'products':
                        const { data: prodData } = await supabase.from('products').select('*, category:categories(*)').eq('tenant_id', tenantId).order('created_at');
                        if (prodData) {
                            setProducts(prodData);
                            localStorage.setItem(`cache_products_${tenantId}`, JSON.stringify(prodData));
                        }
                        break;
                    case 'ingredients':
                        const { data: ingData } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);
                        if (ingData) {
                            setIngredients(ingData);
                            localStorage.setItem(`cache_ingredients_${tenantId}`, JSON.stringify(ingData));
                        }
                        break;
                    case 'orders':
                    case 'order_items': // order_items actualiza la lista de pedidos en la UI
                        if (!isPublic) {
                            const { data: ordData } = await supabase.from('orders').select('*, items:order_items(*)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                            if (ordData) {
                                const validOrders = ordData.filter(o => !((o.payment_method === 'mercadopago' || o.payment_method === 'credito') && !o.is_approved_for_production && o.payment_status === 'pendiente'));
                                setOrders(validOrders);
                            }
                        }
                        break;
                    case 'expenses':
                        if (!isPublic) {
                            const { data: expData } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId).order('date', { ascending: false });
                            if (expData) setExpenses(expData);
                        }
                        break;
                    case 'product_ingredients':
                        const { data: piData } = await supabase.from('product_ingredients').select('*').eq('tenant_id', tenantId);
                        if (piData) setProductIngredients(piData);
                        break;
                    case 'app_notifications':
                        if (!isPublic) {
                            const { data: notifData } = await supabase.from('app_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
                            if (notifData) setNotifications(notifData);
                        }
                        break;
                    case 'ingredient_batches':
                        if (!isPublic) {
                            const { data: batchesData } = await supabase.from('ingredient_batches').select('*').eq('tenant_id', tenantId).order('expiration_date', { ascending: true });
                            if (batchesData) setIngredientBatches(batchesData);
                        }
                        break;
                    case 'product_offers':
                        const { data: offersData } = await supabase.from('product_offers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                        if (offersData) processOffers(offersData);
                        break;
                }
            } catch (err) {
                console.error(`Error cargando tabla ${tableToFetch}:`, err);
            } finally {
                if (!isSilent) setIsLoading(false);
            }
            return;
        }

        // 2. CARGA COMPLETA EN PARALELO (Initial load & manual refresh)
        const promises: Promise<void>[] = [];

        // Categorías
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).order('created_at');
                    if (error) throw error;
                    if (data) {
                        setCategories(data);
                        localStorage.setItem(`cache_categories_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cCat = localStorage.getItem(`cache_categories_${tenantId}`);
                    if (cCat) setCategories(JSON.parse(cCat));
                }
            })()
        );

        // Productos
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('products').select('*, category:categories(*)').eq('tenant_id', tenantId).order('created_at');
                    if (error) throw error;
                    if (data) {
                        setProducts(data);
                        localStorage.setItem(`cache_products_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cProd = localStorage.getItem(`cache_products_${tenantId}`);
                    if (cProd) setProducts(JSON.parse(cProd));
                }
            })()
        );

        // Insumos
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);
                    if (error) throw error;
                    if (data) {
                        setIngredients(data);
                        localStorage.setItem(`cache_ingredients_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cIng = localStorage.getItem(`cache_ingredients_${tenantId}`);
                    if (cIng) setIngredients(JSON.parse(cIng));
                }
            })()
        );

        // Pedidos
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                        if (data) {
                            const validOrders = data.filter(o => !((o.payment_method === 'mercadopago' || o.payment_method === 'credito') && !o.is_approved_for_production && o.payment_status === 'pendiente'));
                            setOrders(validOrders);
                        }
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Gastos
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId).order('date', { ascending: false });
                        if (data) setExpenses(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Recetas
        promises.push(
            (async () => {
                try {
                    const { data } = await supabase.from('product_ingredients').select('*').eq('tenant_id', tenantId);
                    if (data) setProductIngredients(data);
                } catch (err) { /* Silencioso */ }
            })()
        );

        // Notificaciones
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('app_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
                        if (data) setNotifications(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Lotes
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('ingredient_batches').select('*').eq('tenant_id', tenantId).order('expiration_date', { ascending: true });
                        if (data) setIngredientBatches(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Ofertas
        promises.push(
            (async () => {
                try {
                    const { data } = await supabase.from('product_offers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                    if (data) processOffers(data);
                } catch (err) { /* Silencioso */ }
            })()
        );

        await Promise.allSettled(promises);
        if (!isSilent) setIsLoading(false);
    };

    useEffect(() => {
        if (!tenantId) {
            setCategories([])
            setProducts([])
            setIngredients([])
            setOrders([])
            setExpenses([])
            setNotifications([])
            setProductIngredients([])
            setIngredientBatches([])
            setProductOffers([])
            return;
        }

        // Establecer el tenant activo en el proxy de Supabase
        setSupabaseTenant(tenantId);
        fetchData()

        const handlePayload = (payload: any) => {
            console.log(`[REALTIME DEBUG] Evento ${payload.eventType} en ${payload.table} para tenant ${tenantId}`);
            fetchData(true, payload.table);
        };

        const handleBroadcast = (payload: any) => {
            console.log(`[REALTIME BROADCAST] Recibido evento de recarga para tenant ${tenantId}`, payload);
            fetchData(true);
        };

        // 1. Suscribirse al canal de Broadcast para sincronización instantánea independiente de RLS
        const broadcastChannel = supabase
            .channel(`tenant-room-${tenantId}`, {
                config: {
                    broadcast: { self: true } // "Toque invisible": recibe su propio broadcast para refresco inmediato
                }
            })
            .on('broadcast', { event: 'schema-update' }, handleBroadcast)
            .subscribe();

        // 2. Suscribirse a los cambios en tiempo real específicos por tabla (necesario para usuarios anónimos)
        const tables = isPublic
            ? [
                'tenants',
                'categories',
                'products',
                'ingredients',
                'product_ingredients',
                'product_offers'
              ]
            : [
                'tenants',
                'categories',
                'products',
                'ingredients',
                'product_ingredients',
                'orders',
                'order_items',
                'expenses',
                'app_notifications',
                'ingredient_batches',
                'product_offers'
              ];

        let dbChannel = supabase.channel(`db-changes-${tenantId}`);

        tables.forEach(table => {
            dbChannel = dbChannel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table },
                handlePayload
            );
        });

        dbChannel.subscribe((status, err) => {
            if (err) {
                console.error('REALTIME DATABASE ERROR:', err);
            }
            console.log('REALTIME DATABASE STATUS:', status);
        });

        // 3. Fallback de sondeo periódico (Polling) silencioso de 30 segundos para blindar el tiempo real
        // Esto garantiza que la Cocina y Barra reciban los pedidos de incógnito/QR al instante
        // incluso ante limitaciones de RLS en WebSockets o fallos temporales de conexión.
        const pollInterval = setInterval(() => {
            console.log(`[REALTIME POLLING] Refrescando datos preventivamente para tenant ${tenantId}`);
            fetchData(true);
        }, 30000);

        // 4. Heartbeat (Latido) para indicar que el local tiene internet
        let heartbeatInterval: NodeJS.Timeout;
        if (!isPublic && tenantId) {
            // Enviar un ping inmediatamente al cargar
            supabase.from('tenants').update({ last_online_ping: new Date().toISOString() }).eq('id', tenantId).then();
            
            // Y luego cada 2 minutos
            heartbeatInterval = setInterval(() => {
                if (navigator.onLine) {
                    supabase.from('tenants').update({ last_online_ping: new Date().toISOString() }).eq('id', tenantId).then(({error}) => {
                        // if (error) console.error("Error enviando heartbeat:", error); // Silenciado por RLS
                    });
                }
            }, 120000);
        }

        return () => {
            supabase.removeChannel(broadcastChannel);
            supabase.removeChannel(dbChannel);
            clearInterval(pollInterval);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
        };
    }, [tenantId, isPublic])

    return { categories, products, ingredients, orders, expenses, productIngredients, notifications, ingredientBatches, productOffers, isLoading, setOrders, refetch: fetchData }
}
