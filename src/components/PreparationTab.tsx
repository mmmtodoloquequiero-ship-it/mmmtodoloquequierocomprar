'use client';

import React, { useState } from 'react';
import { Order, OrderItem } from '@/types/database';
import { Clock, CheckCircle2, User, ChefHat, Sparkles, Check, Flame, RefreshCw } from 'lucide-react';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';

interface KitchenTabProps {
    orders: Order[];
    products: any[];
    tenant?: any;
    refetchData?: () => void;
}

const getTableDisplayName = (tableNumber: string | null | undefined, tenant: any) => {
    if (!tableNumber) return '';
    const tables = tenant?.tables || [];
    const foundTable = tables.find((t: any) => 
        t.id === tableNumber || 
        t.name?.toLowerCase().trim() === tableNumber.toLowerCase().trim()
    );
    let displayName = foundTable ? foundTable.name : tableNumber;
    
    if (displayName.startsWith('T-') && displayName.length > 5 && !foundTable) {
        return 'Mesa';
    }
    
    if (displayName && !displayName.toLowerCase().startsWith('mesa')) {
        displayName = `Mesa ${displayName}`;
    }
    return displayName;
};

const getOrderDisplayName = (order: any, tenant: any) => {
    if (!order.table_number) {
        return order.client_name || 'Cliente';
    }
    const tableName = getTableDisplayName(order.table_number, tenant);
    const clientName = order.client_name;
    const isCustomClient = clientName && 
                           clientName.toLowerCase() !== 'mesa' && 
                           !clientName.toLowerCase().startsWith('t-') &&
                           clientName.toLowerCase().trim() !== tableName.toLowerCase().replace('mesa', '').trim() &&
                           clientName.toLowerCase().trim() !== tableName.toLowerCase().trim();
                           
    if (isCustomClient) {
        return `${tableName} (${clientName})`;
    }
    return tableName;
};

export default function KitchenTab({ orders, products, tenant, refetchData }: KitchenTabProps) {
    const { addNotification } = useNotifications();
    const [updatingItems, setUpdatingItems] = useState<Record<string, 'pending' | 'delivered'>>({});

    const pendingOrders = orders.filter(o => o.status === 'pending');

    const getTimeAgo = (timestamp: string) => {
        const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
        return diff < 0 ? '0m' : `${diff}m`;
    };

    // Extraer de forma reactiva y sin peticiones locales los productos de cocina
    const getKitchenItemsForOrder = (order: Order): any[] => {
        const items = (order as any).items || [];
        return items.filter((item: any) => item.target_departments?.includes('kitchen'));
    };

    // Obtener el nombre del producto de las props para evitar fetches anidados
    const getProductName = (productId: string) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : 'Producto';
    };

    // Filtrar órdenes que tienen al menos un plato de cocina PENDIENTE
    const ordersWithKitchen = pendingOrders.filter(order => {
        const items = getKitchenItemsForOrder(order);
        // Solo mostrar si tiene platos de cocina Y al menos uno NO está entregado
        return items.length > 0 && items.some(i => i.status !== 'delivered');
    });

    const getOrderLabel = (order: Order) => {
        const orderNum = order.order_number || '?';
        if (order.table_number) {
            return `Pedido de Mesa (Sector Mozos) #${orderNum}`;
        } else if ((order as any).delivery_type === 'delivery') {
            return `Pedido de Delivery (Sector Reparto) #${orderNum}`;
        } else {
            return `Pedido de Caja (Sector Caja/Retiro) #${orderNum}`;
        }
    };

    const handleToggleItemStatus = async (item: any) => {
        const newStatus: 'pending' | 'delivered' = item.status === 'delivered' ? 'pending' : 'delivered';
        
        // Agregar al estado optimista
        setUpdatingItems(prev => ({ ...prev, [item.id]: newStatus }));

        try {
            const { error } = await supabase
                .from('order_items')
                .update({ status: newStatus })
                .eq('id', item.id);

            if (error) {
                throw error;
            }

            const targetOrder = orders.find(o => o.id === item.order_id);

            if (newStatus === 'delivered' && targetOrder) {
                const productName = getProductName(item.product_id);
                const hasMesa = !!targetOrder.table_number;
                const orderLabel = getOrderLabel(targetOrder);
                
                if (hasMesa) {
                    const msg = `🍳 Cocina actualizó el pedido #${targetOrder.order_number} - Mesa ${targetOrder.table_number} (${targetOrder.client_name})`;
                    addNotification(msg, ['waiter', 'staff', 'admin'], 'success', targetOrder.tenant_id);
                } else {
                    const msg = `🍳 Plato listo para ${orderLabel} - ${item.quantity}x ${productName}`;
                    addNotification(msg, ['staff', 'admin'], 'success', targetOrder.tenant_id);
                }
            }

            // Verificar autocompletado del pedido entero
            const { data: allItems } = await supabase
                .from('order_items')
                .select('status')
                .eq('order_id', item.order_id);

            if (allItems && allItems.length > 0 && allItems.every(i => i.status === 'delivered')) {
                const isDelivery = targetOrder && (targetOrder as any).delivery_type === 'delivery';
                const finalStatus = isDelivery ? 'ready' : 'delivered';

                const { error: orderError } = await supabase
                    .from('orders')
                    .update({ status: finalStatus })
                    .eq('id', item.order_id);

                if (!orderError && targetOrder) {
                    const hasMesa = !!targetOrder.table_number;
                    const orderLabel = getOrderLabel(targetOrder);
                    
                    if (hasMesa) {
                        const msg = `🎉 ¡Cocina completó el pedido #${targetOrder.order_number}! - Mesa ${targetOrder.table_number} (${targetOrder.client_name})`;
                        addNotification(msg, ['waiter', 'staff', 'admin'], 'success', targetOrder.tenant_id);
                    } else {
                        const msg = `🎉 ¡PEDIDO ${isDelivery ? 'LISTO PARA REPARTO' : 'COMPLETO LISTO'}! ${orderLabel} para ${targetOrder.client_name || 'Cliente'}`;
                        addNotification(msg, ['staff', 'admin'], 'success', targetOrder.tenant_id);
                        if (isDelivery) {
                            addNotification('Tienes un pedido para entregar', ['delivery'], 'success', targetOrder.tenant_id);
                        }
                    }
                }
            }

            if (targetOrder) {
                broadcastTenantChange(targetOrder.tenant_id || null);
            }
            
            // Llamar al refetch local de inmediato para emular el click en el botón de refrescar
            if (refetchData) {
                refetchData();
            }
        } catch (err: any) {
            // Revertir cambio optimista
            setUpdatingItems(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
            alert('Error al actualizar el estado del plato: ' + err.message);
        } finally {
            // Limpiar del estado optimista
            setUpdatingItems(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
        }
    };

    const handleToggleAllItems = async (order: Order) => {
        const items = getKitchenItemsForOrder(order);
        const pendingItems = items.filter(i => i.status !== 'delivered');
        
        if (pendingItems.length === 0) return;

        for (const item of pendingItems) {
            await handleToggleItemStatus(item);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                        <ChefHat size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase italic tracking-widest bg-gradient-to-r from-amber-400 via-rose-400 to-yellow-400 bg-clip-text text-transparent">Cocina & Comandas</h2>
                        <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Pantalla Operativa del Chef</p>
                    </div>
                </div>
                {ordersWithKitchen.length > 0 && (
                    <div className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                        <Flame size={10} className="fill-slate-950" /> {ordersWithKitchen.length} En Fuego
                    </div>
                )}
            </div>

            {ordersWithKitchen.length === 0 ? (
                <div className="py-24 text-center glass rounded-[3rem] p-10 border-dashed border-2 border-white/5 bg-gradient-to-br from-amber-500/5 to-transparent shadow-xl">
                    <div className="bg-slate-950/80 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                        <CheckCircle2 size={44} className="text-amber-500 animate-bounce" />
                    </div>
                    <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                        <Sparkles size={14} className="text-yellow-400" /> Cocina Despejada
                    </h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">¡Todas las comandas de cocina listas! A descansar.</p>
                </div>
            ) : (
                <div className="grid gap-5">
                    {ordersWithKitchen.map(order => {
                        const kitchenItems = getKitchenItemsForOrder(order);
                        
                        return (
                            <div key={order.id} className="glass rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl hover:border-amber-500/20 transition-all duration-300 bg-gradient-to-br from-amber-500/5 to-rose-500/5">
                                <div className="p-5 bg-slate-950/70 flex justify-between items-center border-b border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(249,115,22,0.2)] border border-white/10 shrink-0">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg text-white leading-none mb-1">{getOrderDisplayName(order, tenant)}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-amber-400 font-black tracking-widest uppercase">Orden #{order.order_number}</span>
                                                {order.table_number && (
                                                    <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase">{getTableDisplayName(order.table_number, tenant)}</span>
                                                )}
                                                {order.origin === 'rappi' && (
                                                    <span className="text-[7.5px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                                                        RAPPI
                                                    </span>
                                                )}
                                                {order.origin === 'pedidosya' && (
                                                    <span className="text-[7.5px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                                                        PEDIDOSYA
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1 text-slate-400 font-black text-xs">
                                            <Clock size={12} className="text-amber-500" />
                                            <span>{getTimeAgo(order.created_at)}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleToggleAllItems(order)}
                                            className="text-[8px] font-black uppercase text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all mt-1"
                                        >
                                            Tildar Todo
                                        </button>
                                    </div>
                                </div>

                                {/* CARTEL DISTINTIVO DE REGALO (SOCIAL DINING) */}
                                {order.client_name?.startsWith('REGALO') && (
                                    <div className="bg-fuchsia-600 text-white p-3 flex flex-col gap-1 shadow-inner border-y border-fuchsia-500">
                                        <div className="flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest animate-pulse">
                                            <span className="text-base">🎁</span>
                                            {order.client_name}
                                        </div>
                                        {kitchenItems.some((i: any) => i.notes?.includes('REGALO PARA:')) && (
                                            <p className="text-center text-[9px] font-medium italic text-fuchsia-100 opacity-90">
                                                Mensaje: {kitchenItems.find((i: any) => i.notes?.includes('REGALO PARA:'))?.notes?.split('| DE:')[0].replace('🎁 REGALO PARA:', '').trim()}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ADVERTENCIA DE PAGO PENDIENTE */}
                                {order.payment_status === 'pendiente' && (
                                    <div className="bg-red-650 text-white font-black px-6 py-2.5 text-[9px] uppercase tracking-widest text-center animate-pulse">
                                        ⚠️ PAGO PENDIENTE: PREPARAR PERO NO ENTREGAR HASTA COBRAR
                                    </div>
                                )}

                                <div className="p-6 space-y-4">
                                    <div className="space-y-2.5">
                                        {kitchenItems.map((item, idx) => {
                                            const currentStatus = updatingItems[item.id] !== undefined ? updatingItems[item.id] : item.status;
                                            const isUpdating = updatingItems[item.id] !== undefined;
                                            const isDelivered = currentStatus === 'delivered';
                                            const prodName = getProductName(item.product_id);
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => !isUpdating && handleToggleItemStatus(item)}
                                                    className={`flex justify-between items-center p-3 rounded-2xl border transition-all duration-300 ${
                                                        isUpdating ? 'cursor-not-allowed opacity-70 border-amber-500/20' : 'cursor-pointer'
                                                    } ${
                                                        isDelivered 
                                                            ? 'bg-slate-950/20 border-white/5 opacity-40 hover:opacity-60' 
                                                            : 'bg-slate-950/60 border-white/10 hover:border-amber-500/30 hover:bg-slate-950/80 shadow-md'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                                                            isDelivered 
                                                                ? 'bg-slate-900 text-slate-600' 
                                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        }`}>
                                                            {item.quantity}x
                                                        </span>
                                                        <div>
                                                            <p className={`font-black text-sm text-white transition-all ${
                                                                isDelivered ? 'line-through text-slate-500' : ''
                                                            }`}>
                                                                {item.notes ? `${item.notes} (${prodName})` : prodName}
                                                            </p>
                                                            <p className="text-[7px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Cocina</p>
                                                        </div>
                                                    </div>

                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                                        isDelivered 
                                                            ? 'bg-amber-500 text-slate-950' 
                                                            : 'bg-white/5 border border-white/10 text-transparent'
                                                    }`}>
                                                        {isUpdating ? (
                                                            <RefreshCw size={12} className="stroke-[3] animate-spin text-amber-400" />
                                                        ) : (
                                                            <Check size={12} className="stroke-[3]" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex pt-2">
                                        <button
                                            onClick={async () => {
                                                await handleToggleAllItems(order);
                                            }}
                                            disabled={kitchenItems.every(i => {
                                                const currentStatus = updatingItems[i.id] !== undefined ? updatingItems[i.id] : i.status;
                                                return currentStatus === 'delivered';
                                            })}
                                            className={`w-full font-black py-4.5 rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest ${
                                                kitchenItems.every(i => {
                                                    const currentStatus = updatingItems[i.id] !== undefined ? updatingItems[i.id] : i.status;
                                                    return currentStatus === 'delivered';
                                                })
                                                    ? 'bg-slate-900/20 border border-slate-800 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer'
                                            }`}
                                        >
                                            Tildar Todo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
