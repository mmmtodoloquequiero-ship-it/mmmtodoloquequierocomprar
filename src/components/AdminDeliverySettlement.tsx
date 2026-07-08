'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, CheckCircle2, ChevronDown, ChevronUp, DollarSign, RefreshCw } from 'lucide-react';
import { Order } from '@/types/database';

const formatARS = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function AdminDeliverySettlement({ tenant }: { tenant: any }) {
  const [unpaidOrders, setUnpaidOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  const fetchUnpaidOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('delivery_type', 'delivery')
      .in('status', ['completed', 'delivered'])
      .eq('is_delivery_paid', false);

    if (data) {
      setUnpaidOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tenant?.id) {
      fetchUnpaidOrders();
    }
  }, [tenant?.id]);

  const handlePay = async (employeeName: string, driverOrders: Order[]) => {
    const isAll = employeeName === 'all';
    const msg = isAll 
      ? '¿Confirmas el pago a TODOS los repartidores por los viajes pendientes? Se registrará un gasto en tu balance.'
      : `¿Confirmas el pago a ${employeeName} por sus viajes pendientes? Se registrará un gasto en tu balance.`;

    if (!confirm(msg)) return;

    setPaying(true);
    try {
      // Usar la API
      const res = await fetch('/api/delivery/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          employeeName // Pasamos el nombre del repartidor
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }

      alert(`✅ ${data.message} Monto abonado: ${formatARS(data.totalPaid)}`);
      await fetchUnpaidOrders(); // Refresh
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  // Group by employeeName (waiter_name)
  const groupedOrders = unpaidOrders.reduce((acc, order) => {
    const driver = order.waiter_name || 'Sin Asignar (Repartidor Externo)';
    if (!acc[driver]) acc[driver] = [];
    acc[driver].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const totalDebt = unpaidOrders.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);

  return (
    <div className="space-y-4 pt-3 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
          💰 Liquidación a Repartidores
        </label>
        <button onClick={fetchUnpaidOrders} className="p-1 text-slate-500 hover:text-white transition-colors" title="Actualizar">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-[9px] text-slate-400 leading-relaxed">
        Aquí verás los viajes de delivery completados que aún no le has pagado a tus repartidores. Al pagar, el dinero se descontará de tu caja automáticamente como un gasto.
      </p>

      {unpaidOrders.length === 0 ? (
        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl text-center">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">No hay deudas pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest block">Deuda Total Acumulada</span>
              <span className="text-2xl font-black text-amber-500 block">{formatARS(totalDebt)}</span>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[9px] font-bold text-slate-400 uppercase text-right">{unpaidOrders.length} viajes</span>
              <button
                onClick={() => handlePay('all', unpaidOrders)}
                disabled={paying}
                className="py-2 px-5 bg-amber-600 hover:bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <CheckCircle2 size={13} />
                {paying ? 'Procesando...' : 'Pagar Todo'}
              </button>
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            {Object.entries(groupedOrders)
              .sort((a, b) => b[1].length - a[1].length) // Descending by number of orders
              .map(([driverName, driverOrders]) => {
                const driverIncome = driverOrders.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);

                return (
                  <div key={driverName} className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="text-xs font-black text-white">{driverName}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        {driverOrders.length} viajes a liquidar
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-base font-black text-white">{formatARS(driverIncome)}</span>
                      <button
                        onClick={() => handlePay(driverName, driverOrders)}
                        disabled={paying}
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg"
                      >
                        <CheckCircle2 size={12} />
                        {paying ? 'Pagando...' : 'Pagar Repartidor'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
