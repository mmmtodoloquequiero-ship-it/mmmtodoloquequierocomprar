'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronRight, LayoutGrid, MapPin, Store, Loader2, ArrowLeft, Paintbrush, Shield, ShoppingBag, ChefHat, Check, UserPlus, LogIn, Search, AlertCircle, Mail, Sun, Moon, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlobalWatermark } from '@/components/GlobalWatermark';

const PRESET_COLORS = [
  { name: 'Naranja Sunset', primary: '#f97316', secondary: '#1e293b' },
  { name: 'Púrpura Neón', primary: '#a855f7', secondary: '#1e1b4b' },
  { name: 'Verde Esmeralda', primary: '#10b981', secondary: '#064e3b' },
  { name: 'Rojo Rubí', primary: '#ef4444', secondary: '#451a03' },
  { name: 'Azul Eléctrico', primary: '#3b82f6', secondary: '#172554' },
  { name: 'Oro Ámbar', primary: '#f59e0b', secondary: '#451a03' },
  { name: 'Rosa Fucsia', primary: '#ec4899', secondary: '#4d0727' },
];

export default function WelcomePage() {
  const router = useRouter();
  
  // App Modes: 'welcome' | 'select' | 'register'
  const [mode, setMode] = useState<'welcome' | 'select' | 'register'>('welcome');

  // List Tenants State
  const [tenants, setTenants] = useState<any[]>([]);
  const [recentTenants, setRecentTenants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register Tenant Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [secondaryColor, setSecondaryColor] = useState('#1e293b');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [adminPassword, setAdminPassword] = useState('');
  const [enabledRoles, setEnabledRoles] = useState<string[]>(['staff', 'kitchen', 'delivery']);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Estados del Registro Público de Deudores del Mes
  const [debtors, setDebtors] = useState<any[]>([]);
  const [loadingDebtors, setLoadingDebtors] = useState(false);
  const [debtorSearch, setDebtorSearch] = useState('');

  // Cargar locales recientes
  useEffect(() => {
    if (mode === 'select') {
      try {
        const stored = localStorage.getItem('recent_tenants');
        if (stored) {
          setRecentTenants(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error parsing recent tenants', e);
      }
    }
  }, [mode]);

  // Cargar deudores al entrar a la bienvenida
  useEffect(() => {
    if (mode === 'welcome') {
      fetchDebtors();
    }
  }, [mode]);

  const fetchDebtors = async () => {
    setLoadingDebtors(true);
    try {
      const { data, error } = await supabase
        .from('customer_tabs')
        .select(`
          id,
          total_debt,
          amount_paid,
          period_start,
          is_locked,
          customers (
            name,
            document_number
          ),
          tenants (
            name
          )
        `)
        .eq('is_settled', false);

      if (!error && data) {
        setDebtors(data);
      }
    } catch (e) {
      console.error('Error loading debtors:', e);
    } finally {
      setLoadingDebtors(false);
    }
  };

  // Buscar local por nombre o correo
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Buscar por coincidencia de nombre o correo
      const { data, error: sbError } = await supabase
        .from('tenants')
        .select('id, name, slug, theme_colors, enabled_roles')
        .or(`name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`)
        .order('name', { ascending: true })
        .limit(5);

      if (sbError) {
        setError('No se pudieron buscar los locales.');
      } else if (!data || data.length === 0) {
        setError('No se encontró ningún local con ese nombre o correo.');
        setTenants([]);
      } else {
        setTenants(data);
      }
    } catch (err) {
      setError('Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  // Generar slug automáticamente desde el nombre
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Convertir a slug amigable (letras, números y guiones)
    const generatedSlug = newName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
      .replace(/[\s_]+/g, '-') // Reemplazar espacios por guiones
      .replace(/^-+|-+$/g, ''); // Limpiar guiones iniciales/finales
    setSlug(generatedSlug);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    
    if (!acceptTerms) {
      setRegisterError('Debes aceptar las Condiciones del Servicio y Políticas de Privacidad para continuar.');
      return;
    }

    // Validaciones básicas
    if (!name.trim() || !slug.trim()) {
      setRegisterError('El nombre y el enlace del local son obligatorios.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setRegisterError('Por favor, ingresa un correo electrónico de registro válido.');
      return;
    }
    if (slug.length < 3) {
      setRegisterError('El enlace del local debe tener al menos 3 caracteres.');
      return;
    }
    if (!adminPassword) {
      setRegisterError('Debes configurar la contraseña de Administrador.');
      return;
    }

    setRegistering(true);

    try {
      // 1. Validar si el Nombre del Local ya existe (Búsqueda exacta e insensible a mayúsculas/minúsculas)
      const { data: existingName } = await supabase
        .from('tenants')
        .select('id')
        .ilike('name', name.trim())
        .maybeSingle();

      if (existingName) {
        setRegisterError('El nombre de este local ya está registrado exactamente igual. Por favor, utiliza una variación (ej: agregando tu calle o ciudad).');
        setRegistering(false);
        return;
      }

      // 2. Validar si el slug ya existe
      const { data: existingSlug } = await supabase
        .from('tenants')
        .select('id')
        .ilike('slug', slug)
        .maybeSingle();

      if (existingSlug) {
        setRegisterError('Esta dirección de enlace ya está en uso por otro local.');
        setRegistering(false);
        return;
      }

      // 3. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: adminPassword,
      });

      if (authError) {
        // If user already exists in auth, we can still proceed to link the tenant if we want, 
        // but typically we should show an error or just proceed if they already have an account.
        // For now, we just log it. If they exist, Supabase Auth might throw "User already registered".
        console.warn('Auth SignUp Note:', authError.message);
      }

      // 4. Crear el Tenant en la Base de Datos
      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert([{
          name: name.trim(),
          slug: slug.trim(),
          email: email.trim().toLowerCase(),
          theme_colors: { primary: primaryColor, secondary: secondaryColor, mode: themeMode },
          enabled_roles: ['admin', ...enabledRoles],
          admin_password: adminPassword,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Insert Error:', insertError);
        setRegisterError('No se pudo registrar el local en la base de datos.');
        setRegistering(false);
        return;
      }

      setRegisterSuccess(true);
      setTimeout(() => {
        // Redirigir al local recién creado de inmediato
        router.push(`/${newTenant.slug}`);
      }, 1500);

    } catch (err) {
      setRegisterError('Hubo un error inesperado al registrar el local.');
    } finally {
      setRegistering(false);
    }
  };

  const recordRecentTenant = (t: any) => {
    try {
      const stored = localStorage.getItem('recent_tenants');
      let recents = stored ? JSON.parse(stored) : [];
      recents = recents.filter((r: any) => r.id !== t.id);
      recents.unshift({ id: t.id, name: t.name, slug: t.slug, theme_colors: t.theme_colors });
      if (recents.length > 3) recents = recents.slice(0, 3);
      localStorage.setItem('recent_tenants', JSON.stringify(recents));
    } catch (e) {}
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white selection:bg-amber-500/30 relative overflow-hidden">
      {/* Fondo de Gradiente Premium */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-950 to-slate-950 pointer-events-none" />

      {/* PANTALLA 1: BIENVENIDA / PREGUNTA INICIAL */}
      {mode === 'welcome' && (
        <>
          <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-10 shadow-2xl border border-white/5 relative z-10 animate-in fade-in zoom-in duration-300">
          
          {/* Isotipo Mmm TodoLoQueQuiero Comer Premium */}
          <div className="hover:scale-105 transition-transform duration-300 w-32 h-32 flex items-center justify-center">
            <img src="/logo.png" alt="Mmm TodoLoQueQuiero Comer" className="w-full h-full object-cover rounded-full drop-shadow-[0_0_20px_rgba(249,115,22,0.3)]" />
          </div>

          {/* Títulos */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black italic text-amber-500 leading-none">mmmTodoLoQueQuiero</h1>
            <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-[9px]">
              Plataforma SaaS Multi-Tenant
            </p>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-xl font-black text-white">¿Cómo deseas ingresar?</h2>
            <p className="text-slate-400 text-xs px-2 leading-relaxed">
              Inicia sesión en un negocio registrado o crea una nueva cuenta de local para comenzar a gestionar ventas, cocina e ingredientes de forma completamente personalizada.
            </p>
          </div>

          {/* Botones de Selección */}
          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => setMode('select')}
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-xl shadow-amber-500/10 uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2 group"
            >
              <LogIn size={14} className="group-hover:translate-x-0.5 transition-transform" />
              Ingresar a mi Local
            </button>

            <button
              onClick={() => setMode('register')}
              className="w-full py-5 bg-slate-900 border border-slate-800 hover:border-white/10 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2 group"
            >
              <UserPlus size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
              Crear Cuenta de Local
            </button>

            <Link href="/franchise" className="w-full mt-2">
              <button
                type="button"
                className="w-full py-4 bg-slate-950 border border-slate-800/50 hover:border-amber-500/30 text-slate-400 hover:text-white font-black rounded-2xl shadow-lg uppercase tracking-widest active:scale-95 transition-all text-[10px] flex items-center justify-center gap-2 group"
              >
                <Store size={14} className="text-slate-500 group-hover:text-amber-500 transition-colors" />
                Acceso Franquicias
              </button>
            </Link>
          </div>

          <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">
            © 2026 mmmTodoLoQueQuiero Inc. Todos los derechos reservados
          </p>
        </div>


      </>
    )}

      {/* PANTALLA 2: SELECCIÓN DE LOCALES ACTIVOS */}
      {mode === 'select' && (
        <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-white/5 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
          
          <div className="w-full flex justify-between items-center pb-2 border-b border-white/5">
            <button onClick={() => setMode('welcome')} className="text-slate-400 hover:text-white p-2 bg-slate-900/50 rounded-xl transition-colors">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-xl font-black italic text-amber-500">Mis Locales</h1>
            <div className="w-9" />
          </div>

          <div className="w-full space-y-4">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Selecciona tu local para acceder a las pantallas de pedidos, cocina y administración.
            </p>

            {/* Buscador Dinámico */}
            <form onSubmit={handleSearch} className="relative w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Correo o Nombre exacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-amber-500/30 rounded-2xl p-3.5 pl-11 text-white text-xs outline-none transition-colors"
                />
              </div>
              <button 
                type="submit" 
                className="bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-2xl font-bold transition-colors"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide">{error}</p>
              </div>
            )}

            {/* Resultados de Búsqueda */}
            {tenants.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider text-center mt-4">Resultados</p>
                {tenants.map((t) => {
                  const accentColor = t.theme_colors?.primary || '#f97316';
                  return (
                    <Link
                      key={t.id}
                      href={`/${t.slug}`}
                      onClick={() => recordRecentTenant(t)}
                      className="w-full bg-slate-900/30 hover:bg-slate-900/80 border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all duration-300 flex items-center justify-between group cursor-pointer hover:scale-[1.02] active:scale-98"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg animate-pulse"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                        >
                          <Store size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white group-hover:text-amber-500 transition-colors">{t.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <MapPin size={9} style={{ color: accentColor }} /> /{t.slug}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Locales Recientes */}
            {!loading && tenants.length === 0 && recentTenants.length > 0 && (
              <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider text-center flex items-center justify-center gap-2">
                  <MapPin size={10} /> Locales Recientes
                </p>
                {recentTenants.map((t) => {
                  const accentColor = t.theme_colors?.primary || '#f97316';
                  return (
                    <Link
                      key={t.id}
                      href={`/${t.slug}`}
                      onClick={() => recordRecentTenant(t)}
                      className="w-full bg-slate-900/30 hover:bg-slate-900/80 border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all duration-300 flex items-center justify-between group cursor-pointer hover:scale-[1.02] active:scale-98"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                        >
                          <Store size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white group-hover:text-amber-500 transition-colors">{t.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <MapPin size={9} style={{ color: accentColor }} /> /{t.slug}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Empty State inicial */}
            {!loading && tenants.length === 0 && recentTenants.length === 0 && !error && (
              <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl text-center space-y-2 mt-4">
                <Store size={24} className="text-slate-600 mx-auto" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Busca tu local</p>
                <p className="text-[10px] text-slate-600">Ingresa tu correo para encontrarlo</p>
                <button
                  onClick={() => setMode('register')}
                  className="mt-2 text-xs font-bold text-amber-500 hover:underline block mx-auto"
                >
                  ¿No tienes uno? Regístrate
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANTALLA 3: CREAR NUEVA CUENTA / REGISTRAR LOCAL */}
      {mode === 'register' && (
        <div className="glass p-8 rounded-[2.5rem] w-full max-w-4xl flex flex-col md:flex-row gap-8 shadow-2xl border border-white/5 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
          
          {/* Columna Izquierda: Formulario de Registro */}
          <div className="flex-1 flex flex-col space-y-6">
            <div className="w-full flex justify-between items-center pb-2 border-b border-white/5">
              <button type="button" onClick={() => setMode('welcome')} className="text-slate-400 hover:text-white p-2 bg-slate-900/50 rounded-xl transition-colors">
                <ArrowLeft size={16} />
              </button>
              <h1 className="text-xl font-black italic text-amber-500">Crear Cuenta SaaS</h1>
              <div className="w-9" />
            </div>

            {registerSuccess ? (
              <div className="w-full py-16 flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-3xl flex items-center justify-center text-green-500 text-3xl shadow-lg">
                  ✓
                </div>
                <h2 className="text-xl font-black text-green-500 italic">¡Cuenta Registrada!</h2>
                <p className="text-slate-400 text-xs text-center px-4 leading-relaxed">
                  El local y tu cuenta han sido creados correctamente. Te estamos redirigiendo a tu nuevo panel de trabajo de inmediato...
                </p>
                <Loader2 size={24} className="text-green-500 animate-spin mt-4" />
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4 max-h-[62vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Bloque 1: Datos de Identidad y Contacto */}
                <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Store size={12} className="text-amber-500" /> Datos de Identidad
                  </p>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Nombre del Local (Debe ser único)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pizzería Don Mario"
                      value={name}
                      onChange={handleNameChange}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500 ml-1 flex items-center gap-1">
                        <Mail size={10} className="text-amber-500" /> Correo Electrónico de Registro
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="Ej: gerencia@donmario.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Dirección de Enlace (URL Slug)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 focus-within:border-white/20 rounded-xl px-3 py-1">
                      <span className="text-[10px] text-slate-600 font-bold tracking-tight select-none">mmmtodoloquequierocomer.com.ar/</span>
                      <input
                        type="text"
                        required
                        placeholder="don-mario"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="w-full bg-transparent p-2 text-white text-xs outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloque 2: Personalización de Colores & Modo Claro/Oscuro */}
                <div className="space-y-4 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Paintbrush size={12} className="text-amber-500" /> Identidad Visual & Tema
                  </p>
                  
                  {/* Presets Rápidos */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase text-slate-500 ml-1">Presets de Paleta Premium</span>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c.primary}
                          type="button"
                          onClick={() => { setPrimaryColor(c.primary); setSecondaryColor(c.secondary); }}
                          className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-md relative"
                          style={{ backgroundColor: c.primary }}
                          title={c.name}
                        >
                          {primaryColor === c.primary && secondaryColor === c.secondary && (
                            <Check size={12} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selección de Colores Custom mediante Inputs */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-500">Color Principal</span>
                        <span className="text-[10px] font-mono font-bold uppercase text-white">{primaryColor}</span>
                      </div>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-500">Color Contraste</span>
                        <span className="text-[10px] font-mono font-bold uppercase text-white">{secondaryColor}</span>
                      </div>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-10 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Selección del Modo del Tema: Claro u Oscuro */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Modo de Interfaz (Esquema de Colores)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setThemeMode('dark')}
                        className={`py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          themeMode === 'dark'
                            ? 'bg-slate-950 border-amber-500/50 text-white shadow-lg'
                            : 'bg-slate-900/30 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <Moon size={14} className={themeMode === 'dark' ? 'text-amber-500' : ''} />
                        Tema Oscuro
                      </button>

                      <button
                        type="button"
                        onClick={() => setThemeMode('light')}
                        className={`py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          themeMode === 'light'
                            ? 'bg-slate-950 border-amber-500/50 text-white shadow-lg'
                            : 'bg-slate-900/30 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <Sun size={14} className={themeMode === 'light' ? 'text-amber-500 animate-spin-slow' : ''} />
                        Tema Claro
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloque: Habilitar Roles */}
                <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <LayoutGrid size={12} className="text-amber-500" /> Roles Activos en tu Local
                  </p>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Selecciona cuáles de estos roles de trabajo estarán habilitados en tu negocio. Los roles desmarcados no aparecerán como opción al iniciar sesión en tu portal.
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {[
                      { id: 'staff', label: 'Caja (Ventas)', desc: 'Pedidos y cobros' },
                      { id: 'kitchen', label: 'Cocina', desc: 'Comandas (KDS)' },
                      { id: 'delivery', label: 'Despacho', desc: 'Envíos y repartos' }
                    ].map(role => (
                      <label key={role.id} className={`p-3 rounded-2xl border cursor-pointer flex flex-col gap-2 transition-all ${
                        enabledRoles.includes(role.id) 
                          ? 'bg-amber-500/10 border-amber-500/40 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black">{role.label}</span>
                          <input
                            type="checkbox"
                            checked={enabledRoles.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) setEnabledRoles([...enabledRoles, role.id]);
                              else setEnabledRoles(enabledRoles.filter(r => r !== role.id));
                            }}
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                            enabledRoles.includes(role.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-700'
                          }`}>
                            {enabledRoles.includes(role.id) && <Check size={10} />}
                          </div>
                        </div>
                        <span className="text-[8px] opacity-60">{role.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Bloque 3: Clave Principal */}
                <div className="space-y-4 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Shield size={12} className="text-amber-500" /> Contraseña Maestra (Administrador)
                    </p>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      Esta es la clave más importante. Te dará acceso a toda la contabilidad, ingresos y configuración del local. Asegúrate de que sea fuerte y no la compartas.
                    </p>
                  </div>

                  <div className="space-y-1 pt-2">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Clave Administrador</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: AdminFuerte123"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-white text-xs outline-none font-bold"
                    />
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-blue-400 text-[9px] font-bold uppercase tracking-wide flex items-start gap-2">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      Nota: Dentro de la aplicación hay un apartado de "Personal" en donde le vas a poder colocar las claves de acceso a los distintos roles que actives.
                    </p>
                  </div>
                </div>

                {registerError && (
                  <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide leading-tight">{registerError}</p>
                  </div>
                )}

                {/* Checkbox de Términos y Condiciones */}
                <div className="flex items-start gap-3 p-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded bg-slate-900 border-slate-700 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                    He leído y acepto las{' '}
                    <Link href="/terminos" target="_blank" className="text-amber-500 hover:underline font-bold">
                      Condiciones del Servicio
                    </Link>{' '}
                    y las{' '}
                    <Link href="/privacidad" target="_blank" className="text-amber-500 hover:underline font-bold">
                      Políticas de Privacidad
                    </Link>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="w-full py-5 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {registering ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={14} />
                      Registrar Local y Lanzar SaaS
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Columna Derecha: Vista Previa Premium en Tiempo Real del Local */}
          <div className="hidden md:flex flex-col w-[340px] bg-slate-900/20 p-6 rounded-[2rem] border border-white/5 items-center justify-center relative self-stretch">
            <div className="absolute top-4 left-6">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Vista Previa de Marca</span>
            </div>
            
            {/* Tarjeta de Dispositivo Virtual */}
            <div
              className={`w-[260px] h-[480px] rounded-[2.5rem] p-5 shadow-2xl flex flex-col justify-between border relative overflow-hidden transition-all duration-500 ${
                themeMode === 'light'
                  ? 'bg-slate-50 text-slate-900 border-slate-200'
                  : 'bg-slate-950 text-white border-white/5'
              }`}
            >
              {/* Sombra / Brillo del color primario */}
              <div
                className="absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-10 pointer-events-none blur-3xl"
                style={{ backgroundColor: primaryColor }}
              />

              {/* Barra superior de Estado */}
              <div className="flex justify-between items-center z-10">
                <div>
                  <h3
                    className="text-[7px] font-black uppercase tracking-[0.2em]"
                    style={{ color: primaryColor }}
                  >
                    {name.trim() || 'Tu Negocio'} • Caja
                  </h3>
                  <div className="flex items-center gap-1">
                    <img src="/logo.png" alt="Logo" className="w-4 h-4 object-contain" />
                    <h1 className="text-sm font-black italic">mmmTodoLoQueQuiero</h1>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <span className="text-[7px] font-bold opacity-40">100% ONLINE</span>
                </div>
              </div>

              {/* Contenido / Simulación de Login */}
              <div className="my-auto flex flex-col items-center space-y-4 z-10">
                <div
                  className="w-16 h-16 flex items-center justify-center transition-transform duration-500 animate-bounce"
                >
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-full drop-shadow-md" />
                </div>
                
                <div className="text-center">
                  <h2 className="text-md font-black leading-tight italic">{name.trim() || 'Mi Local Premium'}</h2>
                  <p className="text-[7px] tracking-widest uppercase opacity-50 mt-1">/{slug || 'enlace-web'}</p>
                </div>

                <div className="w-full space-y-2">
                  <div className="w-full h-8 rounded-xl border opacity-50 flex items-center justify-center text-[8px] font-bold"
                    style={{ borderColor: themeMode === 'light' ? '#cbd5e1' : '#1e293b' }}
                  >
                    ••••••
                  </div>
                  <button
                    type="button"
                    className="w-full h-8 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center justify-center"
                    style={{ backgroundColor: primaryColor, color: '#fff' }}
                  >
                    Iniciar Sesión
                  </button>
                </div>
              </div>

              {/* Menú de Navegación del Dispositivo */}
              <div
                className="w-full rounded-2xl p-1 flex justify-between border z-10 transition-all duration-500"
                style={{
                  backgroundColor: themeMode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.4)',
                  borderColor: themeMode === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.05)'
                }}
              >
                <div className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5" style={{ backgroundColor: primaryColor, color: '#fff' }}>
                  <ShoppingBag size={10} />
                  <span className="text-[6px] font-black uppercase">Caja</span>
                </div>
                <div className="flex-1 py-1 px-1 flex flex-col items-center gap-0.5 opacity-40">
                  <ChefHat size={10} />
                  <span className="text-[6px] font-black uppercase">Cocina</span>
                </div>
                <div className="flex-1 py-1 px-1 flex flex-col items-center gap-0.5 opacity-40">
                  <Shield size={10} />
                  <span className="text-[6px] font-black uppercase">Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <GlobalWatermark />
    </div>
  );
}
