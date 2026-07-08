'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Store, LogIn, Loader2, LogOut, Plus, TrendingUp, TrendingDown, ArrowRight, DollarSign, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Franchise, Tenant } from '@/types/database';

export default function FranchisePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [franchiseName, setFranchiseName] = useState('');

  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantMetrics, setTenantMetrics] = useState<Record<string, { total_sales: number, total_expenses: number, is_profitable: boolean }>>({});
  const [topProducts, setTopProducts] = useState<any[]>([]);

  // Create Branch State
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchSlug, setNewBranchSlug] = useState('');
  const [newBranchAdminEmail, setNewBranchAdminEmail] = useState('');
  const [newBranchAdminPassword, setNewBranchAdminPassword] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // In a real prod environment we should use rpc or standard auth, 
      // but matching the current style we do a direct query (assuming public read is disabled, we simulate auth here or use basic matching if RLS allows it for login logic)
      // Note: We created a policy "Lectura pública de franquicias" for simplicity in the schema earlier.
      const { data, error: fetchError } = await supabase
        .from('franchises')
        .select('*')
        .eq('admin_email', email)
        .eq('admin_password', password)
        .maybeSingle();

      if (fetchError || !data) {
        setError('Credenciales incorrectas o franquicia no encontrada');
      } else {
        setFranchise(data);
        loadDashboardData(data.id);
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!franchiseName.trim()) {
      setError('El nombre de la franquicia es obligatorio');
      setLoading(false);
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('franchises')
        .insert([{
          name: franchiseName,
          admin_email: email,
          admin_password: password
        }])
        .select()
        .maybeSingle();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('El correo electrónico ya está registrado con otra franquicia');
        } else {
          setError('Error al registrar la franquicia: ' + insertError.message);
        }
      } else if (!data) {
        setError('No se pudo crear la franquicia');
      } else {
        setFranchise(data);
        loadDashboardData(data.id);
      }
    } catch (err) {
      setError('Error de conexión al registrar');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (franchiseId: string) => {
    // 1. Fetch Tenants
    const { data: tenantsData, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .eq('franchise_id', franchiseId);

    if (tenantsError || !tenantsData) {
      console.error("Error loading tenants");
      return;
    }

    setTenants(tenantsData);

    const metrics: Record<string, { total_sales: number, total_expenses: number, is_profitable: boolean }> = {};
    let allOrderItems: any[] = [];

    // 2. Fetch Metrics per Tenant
    for (const t of tenantsData) {
      // Sales
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total_price, id, items:order_items(product_id, quantity, product:products(name))')
        .eq('tenant_id', t.id)
        .neq('status', 'pending');

      // Expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('tenant_id', t.id);

      const totalSales = (ordersData || []).reduce((acc, o) => acc + Number(o.total_price), 0);
      const totalExpenses = (expensesData || []).reduce((acc, e) => acc + Number(e.amount), 0);

      metrics[t.id] = {
        total_sales: totalSales,
        total_expenses: totalExpenses,
        is_profitable: totalSales >= totalExpenses
      };

      // Collect items for top products
      if (ordersData) {
        ordersData.forEach(o => {
          if (o.items) {
             // Supabase join sometimes returns array
             const itemsArray = Array.isArray(o.items) ? o.items : [o.items];
             itemsArray.forEach((item: any) => {
               if (item.product && item.product.name) {
                 allOrderItems.push({ name: item.product.name, quantity: item.quantity, tenantName: t.name });
               }
             });
          }
        });
      }
    }

    setTenantMetrics(metrics);

    // Calculate Top Products Global
    const productCounts: Record<string, number> = {};
    allOrderItems.forEach(item => {
      productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
    });

    const sortedProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5

    setTopProducts(sortedProducts);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBranch(true);
    setCreateError('');

    if (!franchise) return;

    try {
      const { data, error } = await supabase
        .from('tenants')
        .insert([{
          name: newBranchName,
          slug: newBranchSlug,
          email: newBranchAdminEmail,
          admin_password: newBranchAdminPassword,
          franchise_id: franchise.id,
          theme_colors: franchise.id ? { primary: '#3b82f6', secondary: '#1e293b', mode: 'dark' } : {}
        }])
        .select();

      if (error) {
        setCreateError(error.message);
      } else {
        setShowCreate(false);
        setNewBranchName('');
        setNewBranchSlug('');
        setNewBranchAdminEmail('');
        setNewBranchAdminPassword('');
        // Reload dashboard
        loadDashboardData(franchise.id);
      }
    } catch (err) {
      setCreateError('Error de red al crear sucursal');
    } finally {
      setCreatingBranch(false);
    }
  };

  if (!franchise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
        <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-7 shadow-2xl border border-white/5 relative z-10 animate-in fade-in">
          
          <div className="bg-blue-600 p-5 rounded-3xl text-4xl shadow-[0_0_30px_rgba(37,99,235,0.35)]">
            <Store />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black italic text-blue-500 leading-none">
              {mode === 'login' ? 'Corporativo' : 'Nueva Franquicia'}
            </h1>
            <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-[9px]">
              {mode === 'login' ? 'Gestión de Franquicias' : 'Registra tu marca'}
            </p>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="w-full space-y-5">
            <div className="space-y-3">
              {mode === 'register' && (
                <input
                  type="text"
                  value={franchiseName}
                  onChange={(e) => setFranchiseName(e.target.value)}
                  className="w-full rounded-2xl p-4 font-bold outline-none text-center tracking-wider border bg-slate-900 border-slate-800 text-white focus:border-blue-500/50"
                  placeholder="Nombre de la Franquicia"
                  required
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl p-4 font-bold outline-none text-center tracking-wider border bg-slate-900 border-slate-800 text-white focus:border-blue-500/50"
                placeholder="Correo del Administrador"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl p-4 font-bold outline-none text-center tracking-widest border bg-slate-900 border-slate-800 text-white focus:border-blue-500/50"
                placeholder="Contraseña"
                required
              />
            </div>
            
            {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider animate-shake">{error}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <><LogIn size={16} /> Entrar al Panel</>
              ) : (
                <><Plus size={16} /> Registrar Franquicia</>
              )}
            </button>
          </form>

          <div className="flex flex-col items-center space-y-3 w-full">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-[10px] uppercase font-black tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
            >
              {mode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes una cuenta? Inicia sesión'}
            </button>

            <Link href="/" className="text-[8px] uppercase font-black tracking-widest text-slate-500 hover:text-white transition-colors">
              ← Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Global Summary
  const globalSales = Object.values(tenantMetrics).reduce((acc, m) => acc + m.total_sales, 0);
  const globalExpenses = Object.values(tenantMetrics).reduce((acc, m) => acc + m.total_expenses, 0);
  const isGlobalProfitable = globalSales >= globalExpenses;

  // Sort tenants by sales for ranking
  const rankedTenants = [...tenants].sort((a, b) => {
    const salesA = tenantMetrics[a.id]?.total_sales || 0;
    const salesB = tenantMetrics[b.id]?.total_sales || 0;
    return salesB - salesA;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header Corporativo */}
      <div className="bg-slate-900 border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black uppercase text-lg shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            {franchise.name[0]}
          </div>
          <div>
            <h1 className="text-xl font-black italic leading-none">{franchise.name}</h1>
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Dashboard Global</span>
          </div>
        </div>
        <button
          onClick={() => { setFranchise(null); setEmail(''); setPassword(''); }}
          className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
        
        {/* Resumen Global */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Salud Financiera de la Franquicia</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-6 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl"><DollarSign size={16} /></div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Ventas Totales</h3>
              </div>
              <p className="text-3xl font-black">${globalSales.toLocaleString()}</p>
            </div>
            
            <div className="glass p-6 rounded-3xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-xl"><TrendingDown size={16} /></div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Gastos Fijos y Operativos</h3>
              </div>
              <p className="text-3xl font-black">${globalExpenses.toLocaleString()}</p>
            </div>

            <div className={`p-6 rounded-3xl border ${isGlobalProfitable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${isGlobalProfitable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {isGlobalProfitable ? <TrendingUp size={16} /> : <AlertTriangle size={16} />}
                </div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${isGlobalProfitable ? 'text-green-500' : 'text-red-500'}`}>
                  Estado Global
                </h3>
              </div>
              <p className={`text-2xl font-black ${isGlobalProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isGlobalProfitable ? 'RENTABLE' : 'EN PÉRDIDAS'}
              </p>
              <p className="text-[10px] uppercase font-bold mt-1 opacity-70">
                Balance neto: ${(globalSales - globalExpenses).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* Panel de Sucursales */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Ranking de Sucursales</h2>
            <button 
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all"
            >
              {showCreate ? 'Cancelar' : <><Plus size={14} /> Nueva Sucursal</>}
            </button>
          </div>

          {showCreate && (
            <div className="mb-6 p-6 rounded-3xl border border-blue-500/30 bg-blue-500/5 animate-in slide-in-from-top-4">
              <h3 className="text-sm font-black italic text-blue-400 mb-4">Crear Nueva Sucursal</h3>
              <form onSubmit={handleCreateBranch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Nombre (ej: Local Centro)" required value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className="rounded-xl p-3 bg-slate-900 border border-slate-800 text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="Slug (ej: local-centro)" required value={newBranchSlug} onChange={e => setNewBranchSlug(e.target.value)} className="rounded-xl p-3 bg-slate-900 border border-slate-800 text-sm outline-none focus:border-blue-500" />
                <input type="email" placeholder="Email del Administrador" required value={newBranchAdminEmail} onChange={e => setNewBranchAdminEmail(e.target.value)} className="rounded-xl p-3 bg-slate-900 border border-slate-800 text-sm outline-none focus:border-blue-500" />
                <input type="text" placeholder="Clave de Administrador" required value={newBranchAdminPassword} onChange={e => setNewBranchAdminPassword(e.target.value)} className="rounded-xl p-3 bg-slate-900 border border-slate-800 text-sm outline-none focus:border-blue-500" />
                {createError && <p className="text-red-500 text-xs md:col-span-2">{createError}</p>}
                <div className="md:col-span-2 flex justify-end mt-2">
                  <button disabled={creatingBranch} type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    {creatingBranch ? <Loader2 className="animate-spin" size={16} /> : 'Registrar e Iniciar Operaciones'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rankedTenants.map((tenant, index) => {
              const m = tenantMetrics[tenant.id] || { total_sales: 0, total_expenses: 0, is_profitable: false };
              return (
                <div key={tenant.id} className="glass p-5 rounded-3xl border border-white/5 flex flex-col relative overflow-hidden group">
                  {/* Semáforo Top Border */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${m.is_profitable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-500">#{index + 1}</span>
                        <h3 className="text-lg font-black italic leading-none">{tenant.name}</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{tenant.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500">Ingresos</p>
                      <p className="text-sm font-bold text-white">${m.total_sales.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500">Gastos</p>
                      <p className="text-sm font-bold text-slate-300">${m.total_expenses.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* SSO Button */}
                  <Link href={`/${tenant.slug}?admin=true`} className="mt-auto">
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 group-hover:bg-blue-600">
                      Entrar a Sucursal <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* Productos Ganadores Globales */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <Package size={16} /> Top 5 Productos Globales
          </h2>
          <div className="glass p-1 rounded-3xl border border-white/5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex justify-between items-center p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                    {i + 1}
                  </span>
                  <span className="font-bold text-sm">{p.name}</span>
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-blue-400">
                  {p.count} vendidos
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <div className="p-8 text-center text-sm font-bold text-slate-500">No hay ventas registradas aún.</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
