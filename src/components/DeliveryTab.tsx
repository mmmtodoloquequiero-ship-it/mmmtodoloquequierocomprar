'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Order, Product, Profile } from '@/types/database';
import { Clock, CheckCircle2, User, Loader2, Navigation, Phone, Check, MapPin, ExternalLink, MessageCircle, ChefHat, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { cleanArgPhone } from '@/lib/phoneUtils';

interface DeliveryTabProps {
  orders: Order[];
  products: Product[];
  tenantColors?: {
    primary: string;
    secondary: string;
    mode: string;
  };
  tenant?: any;
  currentEmployee?: Profile;
}

const formatARS = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function DeliveryTab({ orders, products, tenantColors, tenant, currentEmployee }: DeliveryTabProps) {
  const { addNotification } = useNotifications();


  const isLight = tenantColors?.mode === 'light';
  const primaryColor = tenantColors?.primary || '#f97316';

  // Función auxiliar para determinar si es un delivery
  const isDeliveryOrder = (o: any) => {
    return o.delivery_type === 'delivery' || (!o.table_number && o.delivery_address && o.delivery_address.trim().length > 0);
  };

  // Pedidos de delivery activos (no archivados)
  const activeDeliveries = useMemo(() => {
    return orders.filter(o => 
      isDeliveryOrder(o) && 
      !o.is_archived &&
      o.status !== 'completed' &&
      o.status !== 'delivered'
    );
  }, [orders]);

  // Historial de entregados (Últimos 7 días)
  const deliveredHistorial = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return orders.filter(o => 
      isDeliveryOrder(o) && 
      (o.status === 'completed' || o.status === 'delivered') &&
      new Date(o.created_at) >= sevenDaysAgo
    );
  }, [orders]);

  const getTimeAgo = (timestamp: string) => {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
    return diff < 0 ? '0m' : `${diff}m`;
  };

  // Campana de nuevo pedido de delivery y cuando está listo
  const prevDeliveryStateRef = useRef<Record<string, boolean>>({});
  const [localAlert, setLocalAlert] = useState<{message: string, type: 'new' | 'ready'} | null>(null);

  useEffect(() => {
    const currentState: Record<string, boolean> = {};
    let shouldPlaySound = false;
    let alertMsg: {message: string, type: 'new' | 'ready'} | null = null;

    activeDeliveries.forEach(o => {
      // Un pedido está listo si todos sus items están "delivered" (listos de cocina/barra)
      const isReady = o.items?.every((item: any) => {
        const needsPrep = item.target_departments?.includes('kitchen') || item.target_departments?.includes('bartender');
        if (!needsPrep) return true;
        return item.status === 'delivered';
      }) ?? true;
      
      currentState[o.id] = isReady;

      // Evaluar si es un pedido nuevo, o si acaba de pasar a estar "listo"
      const prevState = prevDeliveryStateRef.current[o.id];
      if (prevState === undefined) {
        // Es un pedido nuevo
        shouldPlaySound = true;
        alertMsg = { message: `¡NUEVO PEDIDO DE DELIVERY! (#${o.order_number})`, type: 'new' };
      } else if (prevState === false && isReady === true) {
        // El pedido acaba de marcarse como listo en cocina/barra
        shouldPlaySound = true;
        alertMsg = { message: `¡PEDIDO #${o.order_number} LISTO PARA REPARTIR!`, type: 'ready' };
      }
    });

    if (shouldPlaySound && Object.keys(prevDeliveryStateRef.current).length > 0) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Campana de delivery bloqueada:', e));
      
      if (alertMsg) {
        setLocalAlert(alertMsg);
        setTimeout(() => setLocalAlert(null), 15000); // Ocultar después de 15 segundos
      }
    }

    prevDeliveryStateRef.current = currentState;
  }, [activeDeliveries]);

    const handleClaimOrder = async (orderId: string) => {
      if (!currentEmployee?.full_name) {
        alert("Debes ingresar con tu PIN de repartidor para tomar un pedido.");
        return;
      }
      const { error } = await supabase
        .from('orders')
        .update({ waiter_name: currentEmployee?.full_name })
        .eq('id', orderId);

      if (error) {
        alert("Error al seleccionar pedido: " + error.message);
      } else {
        document.getElementById('global-refresh-button')?.click();
      }
    };

  const handleDeliverOrder = async (orderId: string, clientName: string) => {
    const orderObj = orders.find(o => o.id === orderId);
    const items = orderObj?.items || [];
    const breakdown = items.map(i => {
      const pName = products.find(p => p.id === i.product_id)?.name || 'Producto';
      return `${i.quantity}x ${pName}`;
    }).join(', ');

    // Fetch fresh order status to avoid stale data stalemate
    const { data: freshOrder } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .single();
      
    const isAlreadyPaid = freshOrder?.payment_status === 'pagado';
    const newStatus = isAlreadyPaid ? 'completed' : 'delivered';
    const archive = isAlreadyPaid;

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, is_archived: archive })
      .eq('id', orderId);

    if (error) {
      alert("Error al marcar como entregado: " + error.message);
    } else {
      const message = `🚚 Pedido de ${clientName} ENTREGADO por el Repartidor: ${currentEmployee?.full_name || 'Local'}: ${breakdown} (Pendiente de cobro en Caja)`;
      addNotification(message, ['staff', 'admin'], 'success', orderObj?.tenant_id);
      document.getElementById('global-refresh-button')?.click();
      alert("¡Pedido marcado como entregado! Recuerda rendir el dinero en Caja si fue en efectivo.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ALERTA VISUAL DE NUEVO PEDIDO O PEDIDO LISTO */}
      {localAlert && (
        <div 
          onClick={() => setLocalAlert(null)}
          className={`cursor-pointer p-6 rounded-3xl border-2 shadow-[0_0_50px_rgba(249,115,22,0.4)] animate-pulse flex flex-col items-center justify-center text-center ${
            localAlert.type === 'new' 
              ? 'bg-gradient-to-r from-amber-500 to-rose-500 border-amber-300' 
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-300'
          }`}
        >
          <Bell size={48} className="text-white mb-2 animate-bounce" />
          <h2 className="text-2xl font-black uppercase tracking-widest text-white drop-shadow-md">
            {localAlert.message}
          </h2>
          <p className="text-white/80 text-xs font-bold uppercase tracking-wider mt-2">
            Toca para ocultar este aviso
          </p>
        </div>
      )}

      {/* Sección 1: Envíos Activos */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-widest text-white leading-none">Reparto & Despacho 🛵</h2>
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider mt-1">Órdenes a Domicilio aprobadas para producción</p>
        </div>
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
          <Navigation size={11} className="fill-slate-950" /> {activeDeliveries.length} Pendientes
        </div>
      </div>

      {activeDeliveries.length === 0 ? (
        <div className="py-24 text-center glass rounded-[3rem] p-10 border-dashed border-2 border-white/5 bg-gradient-to-br from-amber-500/5 to-transparent shadow-xl">
          <div className="bg-slate-950/80 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
            <Navigation size={36} className="text-amber-500 animate-bounce" />
          </div>
          <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Hoja de Ruta Vacía</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">No hay pedidos de Delivery listos para despachar por ahora.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {activeDeliveries.map(order => {
            const clientNameClean = order.client_name?.split('(')[0]?.trim() || 'Cliente';
            const mapsUrl = (order as any).delivery_lat && (order as any).delivery_lng
              ? `https://www.google.com/maps/search/?api=1&query=${(order as any).delivery_lat},${(order as any).delivery_lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order as any).delivery_address || '')}`;
            
            const whatsappUrl = order.phone_number 
              ? `https://wa.me/${cleanArgPhone(order.phone_number)}`
              : null;

            const items = order.items || [];
            const hasItems = items.length > 0;
            const allItemsPrepared = hasItems ? items.every(item => {
              const needsPrep = item.target_departments?.includes('kitchen') || item.target_departments?.includes('bartender');
              if (!needsPrep) return true;
              return item.status === 'delivered';
            }) : false;

            const isPreparing = hasItems ? !allItemsPrepared : true;
            const deliveryFee = Number((order as any).delivery_fee) || 0;
            const orderSubtotal = order.total_price - deliveryFee;

            return (
              <div
                key={order.id}
                className={`glass rounded-[2.5rem] overflow-hidden border transition-all duration-300 ${
                  isPreparing 
                    ? 'border-white/5 bg-slate-900/50' 
                    : 'border-white/5 bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/10'
                }`}
              >
                {/* 1. SECCIÓN DE ENVÍO DESTACADA: PRIMERO Y EN GRANDE */}
                <div className="p-6 bg-slate-950/80 border-b border-white/5 space-y-4">
                  <div className={isPreparing ? 'grayscale opacity-40 pointer-events-none space-y-4' : 'space-y-4'}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest block">📍 DIRECCIÓN DE ENTREGA</span>
                        <h3 className="text-xl font-black text-white leading-tight uppercase">
                          {(order as any).delivery_address || 'Sin Dirección'}
                        </h3>
                      {/* Enlace de Google Maps en caso de que esté presente */}
                      <div>
                        {(order as any).delivery_map_link && (
                          <div className="mt-1">
                            <a 
                              href={(order as any).delivery_map_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 hover:underline"
                            >
                              <ExternalLink size={10} /> Ubicación en Google Maps (Cliente)
                            </a>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-extrabold text-slate-350">
                        Pedido: <span className="text-amber-500 font-black text-base">#{order.order_number}</span> - Cliente: <span className="text-white font-black text-base">{clientNameClean}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-2">
                      <span className="text-sm font-black text-white bg-slate-900 px-4 py-2 rounded-2xl border border-white/5 block">
                        {formatARS(order.total_price)}
                      </span>
                      {order.payment_status === 'pagado' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                          ✅ PAGADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
                          ⚠️ A COBRAR EN LA ENTREGA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desglose de Costos de la Tarjeta */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>Costo del Pedido</span>
                      <span className="text-white font-extrabold">{formatARS(orderSubtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      <span>Costo de Envío</span>
                      <span className="text-amber-400 font-extrabold">+ {formatARS(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider pt-2 border-t border-white/5">
                      <span className="text-white">Monto Total</span>
                      <span className="text-amber-500 font-black text-sm">{formatARS(order.total_price)}</span>
                    </div>
                  </div>

                  {/* Botones de acción del repartidor */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-[9px] uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.15)] active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      🗺️ Abrir Ruta en Google Maps
                    </a>
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle size={13} className="fill-white text-emerald-600" /> WhatsApp Cliente
                      </a>
                    ) : (
                      <button
                        disabled
                        className="py-3.5 bg-slate-900 text-slate-600 font-black rounded-2xl text-[9px] uppercase tracking-wider text-center cursor-not-allowed border border-white/5"
                      >
                        Sin WhatsApp
                      </button>
                    )}
                  </div>

                  {/* Botones de Acción Rápida (WhatsApp 1 Clic) */}
                  <div>
                    {order.phone_number && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <a
                          href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                            `Hola ${clientNameClean}, tu pedido de ${tenant?.name || 'nuestro local'} ya va en camino hacia tu domicilio. 🛵 ¡Atento a la puerta!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        >
                          En Camino 🛵
                        </a>
                        <a
                          href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                            `Hola ${clientNameClean}, ¡ya estoy en la puerta con tu pedido! 🏠🍔 Por favor, ¿podrías salir a recibirme?`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        >
                          Llegué / Estoy afuera 🏠
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    {order.phone_number && (
                      <div className="pt-1 flex items-center gap-1 text-[9px] font-extrabold text-slate-450 uppercase">
                        <Phone size={10} className="text-amber-500" /> Llama al cliente: <a href={`tel:${order.phone_number}`} className="text-amber-400 hover:underline ml-1">{order.phone_number}</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. SECCIÓN DEL PEDIDO: DEBAJO Y SECUNDARIO */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-widest block">📦 Desglose de Productos</span>
                    {items.length === 0 ? (
                      <div className="flex justify-center items-center h-16 w-full animate-pulse">
                        <div className="flex gap-1.5 items-center bg-slate-900/50 px-4 py-2 rounded-full border border-white/5">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                          <span className="text-[9px] font-black uppercase text-amber-500 ml-2 tracking-widest">Cargando Productos...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2 relative">
                        {/* Status general badge */}
                        <div className="absolute -top-3 -right-3 z-10">
                          {isPreparing ? (
                            <span className="bg-amber-500 text-slate-950 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg border-2 border-slate-950 flex items-center gap-1 animate-pulse tracking-widest">
                              <ChefHat size={10} className="fill-slate-950" /> Producción
                            </span>
                          ) : (
                            <span className="bg-emerald-500 text-slate-950 px-2 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg border-2 border-slate-950 flex items-center gap-1 tracking-widest">
                              <Check size={10} className="stroke-[3]" /> Listo
                            </span>
                          )}
                        </div>

                        {items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-xl border border-white/5 relative overflow-hidden group">
                            {/* Indicador de estado por producto */}
                            <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                              (item.target_departments?.includes('kitchen') || item.target_departments?.includes('bartender'))
                                ? item.status === 'delivered' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                                : 'bg-slate-700'
                            }`} />
                            
                            <div className="flex items-center gap-2 pl-2">
                              <span className="bg-slate-950/80 w-6 h-6 rounded-lg text-amber-500 font-black text-[10px] flex items-center justify-center shadow-inner border border-white/5 shrink-0">
                                {item.quantity}
                              </span>
                              <span className="font-extrabold text-xs text-white">
                                {item.notes ? `${item.notes} (${products.find(p => p.id === item.product_id)?.name || 'Producto'})` : (products.find(p => p.id === item.product_id)?.name || 'Producto')}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400">
                              {formatARS(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div> {/* Cierra el contenido del pedido */}
                  </div> {/* Cierra el div grayscale */}
 
                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-wide pt-2 border-t border-white/5 mt-4">
                    <span>Solicitado hace {getTimeAgo(order.created_at)}</span>
                    <span className="text-slate-400">Método: <span className="text-white font-black">{(order as any).payment_method === 'efectivo' ? '💵 Efectivo' : '💳 Pago Digital'}</span></span>
                  </div>
 
                  <div>
                    {!order.waiter_name ? (
                      <button
                        key="claim-btn"
                        onClick={() => handleClaimOrder(order.id)}
                        className="w-full mt-2 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-blue-500/20 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10 animate-pulse"
                      >
                        <User size={14} className="stroke-[3]" />
                        Seleccionar Pedido (Llevar yo)
                      </button>
                    ) : order.waiter_name !== currentEmployee?.full_name ? (
                      <div key="taken-by-other" className="w-full mt-2 text-slate-400 bg-slate-900 border border-slate-800 font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                        <User size={14} />
                        Viaje tomado por {order.waiter_name}
                      </div>
                    ) : (
                      <button
                        key="deliver-btn"
                        onClick={() => {
                          if (isPreparing) {
                            alert("Todavía no está preparado. Tienes que esperar a que Cocina o Barra terminen de preparar el pedido para poder entregarlo.");
                            return;
                          }
                          handleDeliverOrder(order.id, order.client_name);
                        }}
                        className={`w-full mt-2 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10 ${
                          isPreparing 
                            ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                            : 'hover:shadow-amber-500/10 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700'
                        }`}
                      >
                        <Check size={14} className="stroke-[3]" />
                        {isPreparing ? '⏳ Preparándose en Cocina / Barra' : 'Entregado / Finalizar Pedido'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tarjeta Premium de Balance Pendiente de Pago */}
      <div>
        {deliveredHistorial.length > 0 && (() => {
          const unpaidDeliveries = deliveredHistorial.filter(o => !(o as any).is_delivery_paid);
          const totalPendingIncome = unpaidDeliveries.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);
          const driverBreakdown = unpaidDeliveries.reduce((acc, order) => {
            const driver = order.waiter_name || 'Sin Asignar (Local)';
            if (!acc[driver]) acc[driver] = 0;
            acc[driver] += (Number((order as any).delivery_fee) || 0);
            return acc;
          }, {} as Record<string, number>);

          return (
            <div className="glass rounded-[2.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950/80 p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest block">📊 BOLSA ACUMULADA</span>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">Pendiente de Cobro</h3>
                </div>
                <div className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest">
                  Acumulado
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-amber-500/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest block">💰 Total a Rendir</span>
                    <span className="text-3xl font-black text-amber-500 block">{formatARS(totalPendingIncome)}</span>
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">{unpaidDeliveries.length} viajes sin liquidar</span>
                  </div>
                </div>
                
                {/* Desglose por Repartidor */}
                <div>
                  {Object.keys(driverBreakdown).length > 0 && (
                    <div className="pt-3 border-t border-white/5 space-y-2">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">👨‍🏍 Desglose por Repartidor</span>
                      {Object.entries(driverBreakdown).map(([driver, amount], idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <User size={10} className="text-slate-500" /> {driver}
                          </span>
                          <span className="text-amber-400 font-black">{formatARS(amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-[8px] font-bold text-slate-500 uppercase text-center tracking-wider">
                💡 Nota: Este balance suma las tarifas de envío de los últimos 7 días que el administrador aún no te ha liquidado.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Historial de Envíos Agrupado por Día (Últimos 7 días) */}
      <div>
        {deliveredHistorial.length > 0 && (() => {
          // Agrupar por fecha
          const grouped = deliveredHistorial.reduce((acc, order) => {
            // Usamos la fecha local de creacion de la orden para agrupar
            const d = new Date(order.created_at);
            const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(order);
            return acc;
          }, {} as Record<string, typeof deliveredHistorial>);

          return Object.entries(grouped).map(([dateLabel, dayOrders], groupIdx) => {
            const totalDayDeliveries = dayOrders.length;
            const totalDayIncome = dayOrders.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);
            
            return (
              <div key={groupIdx} className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex justify-between items-end px-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 leading-none capitalize">{dateLabel}</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{totalDayDeliveries} viajes realizados</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-amber-400">{formatARS(totalDayIncome)}</span>
                  </div>
                </div>
                <div className="grid gap-3">
                  {dayOrders.map(order => {
                    const clientNameClean = order.client_name?.split('(')[0]?.trim() || 'Cliente';
                    const deliveryFee = Number((order as any).delivery_fee) || 0;
                    const isPaid = (order as any).is_delivery_paid;
                    
                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-white/5 bg-slate-900/20 flex justify-between items-center transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-550/10 text-green-550 flex items-center justify-center shrink-0 border border-green-500/20">
                            <Check size={14} className="stroke-[3]" />
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-white">
                              <span className="text-amber-500 font-black mr-1.5">#{order.order_number}</span>
                              {clientNameClean}
                            </p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                              Dirección: {(order as any).delivery_address || 'Entregado en local'}
                            </p>
                            <p className="text-[8.5px] font-extrabold text-slate-450 uppercase mt-0.5">
                              Envío: <span className="text-amber-450">{formatARS(deliveryFee)}</span> | Total: <span className="text-white">{formatARS(order.total_price)}</span>
                            </p>
                          </div>
                        </div>
                        <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full shrink-0 ${isPaid ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                          {isPaid ? 'Liquidado' : 'Pendiente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>


    </div>
  );
}
