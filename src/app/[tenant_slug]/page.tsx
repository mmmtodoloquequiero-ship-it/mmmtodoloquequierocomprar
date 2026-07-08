'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { supabase, supabaseAnon, setSupabaseTenant } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useOfflineStore } from '@/lib/offlineStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { UserRole, Profile } from '@/types/database';
import { Bell, ShoppingBag, ChefHat, Settings, LogOut, Wifi, WifiOff, X, AlertCircle, CheckCircle, CheckCircle2, Trash2, Shield, Lock, MapPin, Loader2, ArrowLeft, Navigation, GlassWater, Clock, Check, RefreshCw, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { MaxesLogo, MaxesWatermark, MaxesCornerFrame } from '@/components/MaxesLogo';
import { GlobalWatermark } from '@/components/GlobalWatermark';

import OrderTab from '@/components/OrderTab';
import PreparationTab from '@/components/PreparationTab';
import AdminTab from '@/components/AdminTab';
import DeliveryTab from '@/components/DeliveryTab';

interface TenantPageProps {
  params: Promise<{ tenant_slug: string }>;
}

export default function TenantApp({ params }: TenantPageProps) {
  const { tenant_slug } = use(params);

  // Tenant State
  const [tenant, setTenant] = useState<any | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState('');
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);

  // Authentication State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [password, setPassword] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // App General State
  const [activeTab, setActiveTab] = useState<'orders' | 'kitchen' | 'admin' | 'delivery'>('orders');
  const [isOnline, setIsOnline] = useState(true);
  const [showNotificationOverlay, setShowNotificationOverlay] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Fetch data only if tenant is loaded and user is logged in
  const { categories, products, ingredients, orders, expenses, productIngredients, notifications, ingredientBatches, productOffers, refetch } = useRealtimeData(
    profile ? tenant?.id : null
  );

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await refetch(false); // Llama a refetch de useRealtimeData forzando carga visual
    } catch (err) {
      console.error("Error al refrescar datos:", err);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const { clearAll, removeNotification, addNotification } = useNotifications();
  const { syncQueue } = useOfflineStore();

  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const { isSupported, isSubscribed, subscribeToPush } = usePushNotifications(deviceFingerprint);

  // Load device fingerprint on mount if logged in
  useEffect(() => {
    if (tenant?.id) {
      const stored = localStorage.getItem(`device_fingerprint_${tenant.id}`);
      if (stored) setDeviceFingerprint(stored);
    }
  }, [tenant?.id]);

  // Redirect customers scanning table QRs directly to the menu page
  // SSO Check for Franchise Admins
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tableId = params.get('table');
      if (tableId) {
        window.location.href = `/${tenant_slug}/menu${window.location.search}`;
        return;
      }

      const isAdminSSO = params.get('admin') === 'true';
      if (isAdminSSO && tenant?.id) {
        setProfile({
          id: tenant.id,
          full_name: 'Admin Franquicia',
          role: 'admin'
        });
        setActiveTab('admin');
        // Quitar el param de la URL para que quede limpio
        window.history.replaceState({}, document.title, `/${tenant_slug}`);
      }
    }
  }, [tenant_slug, tenant]);

  // Load Tenant info
  const loadTenant = useCallback(async (isSilent: boolean = false) => {
    try {
      if (!isSilent) setLoadingTenant(true);
      
      // Intentar consulta con todas las columnas (incluyendo las nuevas de Envíos y Mercado Pago)
      let { data, error } = await supabaseAnon
        .from('tenants')
        .select('*, description')
        .ilike('slug', tenant_slug)
        .maybeSingle();

      // Fallback defensivo si hay un error (por ejemplo, porque no se ha corrido el script SQL de migración y faltan columnas)
      if (error) {
        console.warn("⚠️ Error al cargar tenant con columnas extendidas. Intentando fallback básico...", error);
        const fallbackQuery = await supabaseAnon
          .from('tenants')
          .select('id, name, slug, theme_colors, enabled_roles, location_lat, location_lng, tables, waiters, description, delivery_days')
          .ilike('slug', tenant_slug)
          .maybeSingle();

        if (!fallbackQuery.error && fallbackQuery.data) {
          data = {
            ...fallbackQuery.data,
            mercadopago_public_key: '',
            has_delivery: false
          } as any;
          error = null;
          console.warn("⚠️ ALERTA: Local cargado en modo de compatibilidad. Faltan las columnas de Envíos y Mercado Pago en la tabla 'tenants'. Ejecuta el script SQL en Supabase para habilitar todas las funciones premium.");
        }
      }

      if (error || !data) {
        if (!isSilent) {
          setTenantError(`El local que buscas no existe o está desactivado. (Detalle: ${error?.message || 'No encontrado'})`);
        }
      } else {
        setTenant(data);
        // El public no tiene sesiA3n
        setSupabaseTenant(data.id);
        
        // Actualizar el título de la pestaña dinámicamente con el nombre del local
        if (data.name) {
            document.title = `${data.name} | Mmm TodoLoQueQuiero Comer`;
        }

        // Usar supabase (con cabecera de tenant) en lugar de supabaseAnon para pasar la política RLS
        const { data: subData } = await supabase
          .from('saas_subscriptions')
          .select('status, plan_id, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey(*)')
          .eq('tenant_id', data.id)
          .maybeSingle();

        let activeFeatures: string[] = [];
        if (subData && (subData.status === 'active' || subData.status === 'trial')) {
          activeFeatures = (subData.saas_plans as any)?.features || [];
        } else {
          // Si no tiene suscripción o está vencida, por defecto tiene los permisos básicos
          const { data: basicPlan } = await supabaseAnon
            .from('saas_plans')
            .select('features')
            .eq('name', 'Básico')
            .maybeSingle();
          activeFeatures = basicPlan?.features || ["KDS Cocina", "POS Caja", "Facturación AFIP", "Soporte Estándar"];
        }
        setPlanFeatures(activeFeatures);

        const { data: emps } = await supabaseAnon.from('employees').select('id, name, role').eq('tenant_id', data.id);
        if (emps) setEmployees(emps);
      }
    } catch (e: any) {
      if (!isSilent) setTenantError('Hubo un error al conectar con el servidor: ' + (e?.message || e));
    } finally {
      if (!isSilent) setLoadingTenant(false);
    }
  }, [tenant_slug]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  // Pre-seleccionar rol en la carga inicial y recuperar sesión
  useEffect(() => {
    if (tenant) {
      // 1. Intentar recuperar sesión persistente para evitar deslogueo por pull-to-refresh (Usando localStorage para sobrevivir PWA webview recycling)
      const savedProfileStr = localStorage.getItem(`active_profile_${tenant.id}`);
      if (savedProfileStr && !profile) {
        try {
          const savedProfile = JSON.parse(savedProfileStr);
          setProfile(savedProfile);
          setSupabaseTenant(tenant.id, savedProfile.session_id);
          
          const role = savedProfile.role;
          if (role === 'kitchen') setActiveTab('kitchen');
          else if (role === 'delivery') setActiveTab('delivery');
          else if (role === 'admin') setActiveTab('admin');
          else setActiveTab('orders');
          return; // Salir si recuperó sesión
        } catch(e) {
          console.warn("No se pudo parsear perfil guardado");
        }
      }

      // 2. Si no hay sesión, auto-seleccionar el rol principal por defecto
      if (!selectedRole) {
        const availableRolesLocal = tenant.enabled_roles || ['admin', 'staff', 'delivery'];
        if (availableRolesLocal.includes('staff')) {
          setSelectedRole('staff');
        } else if (availableRolesLocal.includes('delivery')) {
          setSelectedRole('delivery');
        } else {
          setSelectedRole('admin');
        }
      }
    }
  }, [tenant, selectedRole, profile]);

  // Sincronizar activeTab con el historial del navegador (URL hash)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['admin', 'orders', 'kitchen', 'waiter', 'delivery', 'bartender', 'menu', 'animador'];
      if (validTabs.includes(hash)) {
        setActiveTab(hash as any);
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activeTab && window.location.hash !== `#${activeTab}`) {
      // Usamos pushState si no es el primer mount para no ensuciar el historial, o si cambia manualmente
      window.history.pushState(null, '', window.location.pathname + window.location.search + `#${activeTab}`);
    }
  }, [activeTab]);

  // Suscripción al canal de Broadcast de Tenant para recarga instantánea en tiempo real
  useEffect(() => {
    if (!tenant?.id) return;

    const handleBroadcast = (payload: any) => {
      console.log('[BROADCAST TENANT] Recibido evento de recarga, actualizando información del local...');
      loadTenant(true);
    };

    const broadcastChannel = supabase
      .channel(`tenant-room-${tenant.id}`, {
        config: {
          broadcast: { self: false }
        }
      })
      .on('broadcast', { event: 'schema-update' }, handleBroadcast)
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
    };
  }, [tenant?.id, loadTenant]);

  // Polling de seguridad de 5 segundos para sincronizar el local ante limitaciones de RLS / WebSockets
  useEffect(() => {
    if (!tenant?.id) return;

    const interval = setInterval(() => {
      console.log('[POLLING TENANT] Sincronizando información del local...');
      loadTenant(true);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [tenant?.id, loadTenant]);

  // Suscripción en tiempo real a cambios en el Tenant (Mesas, Mozos, etc.)
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`tenant-realtime-${tenant.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tenants', 
          filter: `id=eq.${tenant.id}` 
        },
        (payload) => {
          console.log('[REALTIME TENANT] Actualizando información:', payload.new);
          setTenant((prev: any) => {
            if (!prev) return payload.new;
            return { ...prev, ...payload.new };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // Colores y esquema de tema dinámicos basados en el tenant activo
  const primaryColor = tenant?.theme_colors?.primary || '#f97316';
  const secondaryColor = tenant?.theme_colors?.secondary || '#1e293b';
  const themeMode = tenant?.theme_colors?.mode || 'dark';
  const isLight = themeMode === 'light';

  // Array de roles activos calculado dinámicamente según los empleados existentes
  const baseRoles: UserRole[] = ['admin', 'staff'];
  if (employees.some(e => e.role === 'delivery')) baseRoles.push('delivery');
  
  const availableRoles = baseRoles as UserRole[];

  // Notification Filtering
  const filteredNotifications = notifications.filter(n => {
    if (!profile) return false;

    // REGLA ESTRICTA: Si estamos en la pestaña de delivery, SOLO mostramos notificaciones de delivery, 
    // sin importar si somos admin o staff.
    if (activeTab === 'delivery') {
      return n.target_roles.includes('delivery');
    }

    // ADMIN: Ve todo SIEMPRE en su campana principal
    if (profile.role === 'admin') {
      return true;
    }

    // COCINA: Solo ve notificaciones para 'kitchen' (Nuevos pedidos)
    if (profile.role === 'kitchen') {
      return n.target_roles.includes('kitchen');
    }

    // BARTENDER: Solo ve notificaciones para 'bartender'
    if (profile.role === 'bartender') {
      return n.target_roles.includes('bartender');
    }

    // STAFF (Ventas): Ve sus notificaciones + las de todos los departamentos operativos
    if (profile.role === 'staff') {
      return n.target_roles.includes('staff') || 
             n.target_roles.includes('kitchen') || 
             n.target_roles.includes('bartender') || 
             n.target_roles.includes('delivery');
    }

    // WAITER: Ve llamados de mozo y platos listos de su sector o mesas libres
    if (profile.role === 'waiter') {
      const isTargeted = n.target_roles.includes('waiter');
      if (!isTargeted) return false;

      // Traductores inlined rápidos para coherencia RLS
      const tablesList = tenant?.tables || [];
      const translateTableIdToName = (tableId: string): string => {
        if (!tableId) return 'Mesa';
        const found = tablesList.find((t: any) => t.id === tableId || t.name === tableId);
        if (found) return found.name;
        const numMatch = tableId.match(/\d+/);
        if (numMatch) return `Mesa ${numMatch[0]}`;
        return tableId;
      };
      
      const translateNotificationMessage = (message: string): string => {
        if (!message) return '';
        let translated = message;
        const techIdMatches = message.match(/t_\d+/g);
        if (techIdMatches) {
          techIdMatches.forEach(techId => {
            const name = translateTableIdToName(techId);
            translated = translated.replace(techId, name);
          });
        }
        return translated;
      };

      const msgLower = translateNotificationMessage(n.message).toLowerCase();
      let isAssistance = msgLower.includes('asistencia') || 
                         msgLower.includes('mesa') || 
                         msgLower.includes('mozo') || 
                         msgLower.includes('llamado');

      if (isAssistance) {
        const tableMatch = tablesList.find((t: any) => {
          const name = (t.name || '').toLowerCase();
          const numMatch = name.match(/\d+/);
          if (msgLower.includes(name)) return true;
          if (numMatch) {
            const num = numMatch[0];
            return msgLower.includes(`mesa ${num}`) || msgLower.includes(`mesa: ${num}`) || msgLower.includes(`mesa #${num}`);
          }
          return false;
        });

        // Si la alerta es de una mesa asignada a otro mozo, la ignoramos completamente
        const storedWaiter = typeof window !== 'undefined' ? localStorage.getItem(`active_waiter_name_${tenant?.id}`) : null;
        if (tableMatch && tableMatch.waiter_name && storedWaiter && tableMatch.waiter_name !== storedWaiter) {
          return false;
        }
      }
      return true;
    }

    // DELIVERY: Ve notificaciones de 'delivery'
    if (profile.role === 'delivery') {
      return n.target_roles.includes('delivery');
    }

    return false;
  });

  // Stock Alert logic (Grouped)
  const stockAlertTriggered = useRef(false);
  useEffect(() => {
    if (!profile || profile.role === 'kitchen' || profile.role === 'bartender' || profile.role === 'delivery') return;
    
    const lowStockIngs = ingredients.filter(ing => ing.stock_level <= ing.min_stock_alert);
    if (lowStockIngs.length > 0) {
      if (stockAlertTriggered.current) return; // Ya se notificó o está en proceso para este lote
      
      const hasExistingAlert = (notifications as any[]).some(n => n.type === 'alert');
      if (!hasExistingAlert) {
        stockAlertTriggered.current = true;
        const msg = `Atención: ${lowStockIngs.length} insumos con stock bajo (${lowStockIngs.map(i => i.name).slice(0, 3).join(', ')}${lowStockIngs.length > 3 ? '...' : ''})`;
        addNotification(msg, ['admin', 'staff'], 'alert').catch(err => {
          console.error('Error adding stock alert notification:', err);
          stockAlertTriggered.current = false;
        });
      } else {
        stockAlertTriggered.current = true;
      }
    } else {
      stockAlertTriggered.current = false;
    }
  }, [ingredients, notifications, profile, addNotification]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue(); // Sincronizar automáticamente al recuperar internet
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Notification Sound logic
  const lastNotifCount = useRef(0);
  useEffect(() => {
    if (!profile) return;
    const playSound = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Sound blocked by browser:', e));
    };

    if (filteredNotifications.length > lastNotifCount.current) {
      playSound();
    }
    lastNotifCount.current = filteredNotifications.length;
  }, [filteredNotifications.length, profile]);

  // Intercepción del botón Atrás del celular/PWA
  useEffect(() => {
    if (!profile) return;
    
    // Inyectamos un estado inicial en el historial para "atrapar" el popstate
    window.history.pushState({ appActive: true }, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      // Al intentar salir con "Atrás", volvemos a poner el estado
      window.history.pushState({ appActive: true }, '', window.location.href);
      // Disparamos un evento custom para que los componentes (OrderTab, AdminTab) cierren sus modales
      window.dispatchEvent(new Event('app-go-back'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [profile]);

  // Wake Lock: Evitar que la pantalla se apague mientras usan el sistema
  useEffect(() => {
    if (!profile) return;
    
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock Activo: Pantalla no se apagará');
        }
      } catch (err: any) {
        console.error('Wake Lock falló:', err.message);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) wakeLock.release().then(() => { wakeLock = null; });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile]);
  // Escuchar revocación de dispositivos en tiempo real
  useEffect(() => {
    if (!profile || profile.role === 'admin' || !tenant?.id) return;

    const currentFingerprint = localStorage.getItem(`device_fingerprint_${tenant.id}`);
    if (!currentFingerprint) return;

    const revocationChannel = supabase
      .channel(`device-revocation-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'active_devices', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.old.device_fingerprint === currentFingerprint) {
            alert('⚠️ Tu acceso ha sido revocado por el administrador.');
            localStorage.removeItem(`device_fingerprint_${tenant.id}`);
            setProfile(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(revocationChannel);
    };
  }, [profile, tenant?.id]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      if (selectedRole === 'admin') {
        if (!tenant?.email) {
          setError('El local no tiene un correo configurado.');
          setLoggingIn(false);
          return;
        }

        // Login using Supabase Auth
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: tenant.email,
          password: password,
        });

        if (authError) {
          console.warn(`[Auth Fallback] Intento con Supabase Auth fallido (${authError.message}). Usando RPC legacy...`);
          // Fallback legacy (por si aún no se migró el usuario a auth.users en la DB)
          const { data: legacyData, error: rpcError } = await supabase.rpc('check_tenant_credential', {
            p_slug: tenant_slug,
            p_role: selectedRole,
            p_password: password
          });

          if (!rpcError && legacyData?.success) {
            const adminProfile = {
              id: legacyData.tenant_id,
              full_name: 'Administrador',
              role: 'admin' as UserRole,
              session_id: legacyData.session_id
            };
            localStorage.setItem(`active_profile_${tenant.id}`, JSON.stringify(adminProfile));
            setProfile(adminProfile);
            setSupabaseTenant(legacyData.tenant_id, legacyData.session_id);
            setActiveTab('admin');
          } else {
            setError('Credenciales incorrectas');
            setPassword('');
          }
        } else if (data.session) {
          const adminProfile = {
            id: tenant.id,
            full_name: 'Administrador',
            role: 'admin' as UserRole
          };
          localStorage.setItem(`active_profile_${tenant.id}`, JSON.stringify(adminProfile));
          setProfile(adminProfile);
          setSupabaseTenant(tenant.id);
          setActiveTab('admin');
        }
      } else {
        if (!selectedEmployeeId) {
          setError('Selecciona tu nombre de la lista');
          setLoggingIn(false);
          return;
        }

        // 1. Verificar credenciales con PIN
        const { data, error: rpcError } = await supabase.rpc('check_employee_credential', {
          p_tenant_id: tenant.id,
          p_employee_id: selectedEmployeeId,
          p_pin: password
        });

        if (rpcError || !data?.success) {
          setError(data?.error || 'PIN incorrecto');
          setPassword('');
          return;
        }

        // 2. Obtener o generar huella del dispositivo
        let fingerprint = localStorage.getItem(`device_fingerprint_${tenant.id}`);
        if (!fingerprint) {
          fingerprint = Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
        }

        // 3. Comprobar si este perfil ya está siendo usado de forma activa en otro dispositivo
        const { data: duplicateDevices, error: dupError } = await supabase
          .from('active_devices')
          .select('id, device_fingerprint')
          .eq('employee_id', selectedEmployeeId)
          .neq('device_fingerprint', fingerprint);

        if (dupError) {
          console.error("Error al verificar duplicidad de sesión:", dupError);
          setError('Error al verificar la sesión activa de este perfil');
          setPassword('');
          return;
        }

        if (duplicateDevices && duplicateDevices.length > 0) {
          setError('Este perfil ya está siendo utilizado en otro dispositivo activo.');
          setPassword('');
          return;
        }

        // 4. Comprobar el límite máximo de dispositivos permitidos del local
        const { data: activeDevs, error: devCountError } = await supabase
          .from('active_devices')
          .select('id, device_fingerprint')
          .eq('tenant_id', tenant.id);

        if (devCountError) {
          console.error("Error al verificar límite de dispositivos activos:", devCountError);
          setError('Error al verificar el límite de dispositivos activos');
          setPassword('');
          return;
        }

        // Si es un dispositivo nuevo (su huella no está en la base de datos), verificar si hay espacio
        const alreadyRegistered = activeDevs?.some(d => d.device_fingerprint === fingerprint);
        if (!alreadyRegistered) {
          const currentCount = activeDevs?.length || 0;
          const maxAllowed = tenant.max_devices || 3;
          if (currentCount >= maxAllowed) {
            setError(`Límite de dispositivos activos alcanzado (${currentCount}/${maxAllowed}). El administrador debe liberar espacio o aumentar el límite permitido.`);
            setPassword('');
            return;
          }
        }

        // Registrar/Guardar huella localmente
        localStorage.setItem(`device_fingerprint_${tenant.id}`, fingerprint);
        setDeviceFingerprint(fingerprint);
        
        // Registrar en la base de datos
        await supabase.rpc('register_active_device', {
          p_tenant_id: tenant.id,
          p_employee_id: selectedEmployeeId,
          p_fingerprint: fingerprint,
          p_user_agent: navigator.userAgent
        });

        const newProfile = {
          id: selectedEmployeeId,
          full_name: data.name,
          role: data.role,
          session_id: data.session_id
        };
        
        // Guardar sesión de forma persistente para resistir pull-to-refresh (localStorage sobrevive PWAs en Motorola)
        localStorage.setItem(`active_profile_${tenant.id}`, JSON.stringify(newProfile));
        
        setProfile(newProfile);
        setSupabaseTenant(tenant.id, data.session_id);
        
        const role = data.role;
        if (role === 'kitchen') setActiveTab('kitchen');
        else if (role === 'delivery') setActiveTab('delivery');
        else setActiveTab('orders');
      }
    } catch (err) {
      setError('Error al conectar con la base de datos');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!resetEmail) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }

    setLoggingIn(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + `/${tenant_slug}`,
      });
      if (resetError) {
        setError('Error al enviar el correo: ' + resetError.message);
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      setError('Error de conexión.');
    } finally {
      setLoggingIn(false);
    }
  };

  // Cargar pantalla de loading
  if (loadingTenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
        <Loader2 size={48} className="text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando local...</p>
      </div>
    );
  }

  // Cargar pantalla de error de tenant
  if (tenantError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white text-center">
        <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-white/5">
          <div className="bg-red-500/10 p-5 rounded-3xl text-red-500 text-5xl">⚠️</div>
          <h1 className="text-2xl font-black text-red-500 italic">Error de Acceso</h1>
          <p className="text-slate-400 text-sm">{tenantError}</p>
          <Link href="/" className="w-full py-4 bg-slate-900 border border-slate-800 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs">
            Volver a Locales
          </Link>
        </div>
      </div>
    );
  }

    // Pantalla de Suspensión (Controlado por CEO / MAXES)
    if (tenant?.is_suspended) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white text-center relative overflow-hidden">
          <MaxesWatermark />
          <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-red-500/20 relative z-10 overflow-hidden">
            <MaxesCornerFrame color="red" opacity="opacity-50" />
            <MaxesLogo appName="Mmm TodoLoQueQuiero CEO" scale={1} className="mb-4" />
            <div className="bg-red-500/10 p-4 rounded-3xl text-red-500 border border-red-500/30">
              <Lock size={48} />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-widest">Acceso Restringido</h1>
            <p className="text-slate-400 text-sm font-bold">El servicio de este local se encuentra temporalmente suspendido por falta de pago o revisión técnica.</p>
            <p className="text-xs text-slate-500 italic mt-4">Comunícate con el soporte técnico de MAXES Clan.</p>
          </div>
        </div>
      );
    }

  // Cargar pantalla de Login adaptada al tema (Claro u Oscuro) y Roles de la DB
  if (!profile) {
    const isLight = themeMode === 'light';
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen p-6 transition-colors duration-500 relative ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'}`}>
        {!isLight && <MaxesWatermark />}
        <div className={`relative z-10 p-8 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-7 shadow-2xl border transition-all duration-500 overflow-hidden ${isLight ? 'bg-white border-slate-200/80 shadow-slate-200/80' : 'glass border-white/5 shadow-black/80'}`}>
          {!isLight && <MaxesCornerFrame color="gold" opacity="opacity-50" />}
          <div className="transition-transform hover:scale-110 duration-300 w-32 h-32 flex items-center justify-center relative">
            <img src="/logo.png" alt="Logo Mmm TodoLoQueQuiero Comer" className="w-full h-full object-cover rounded-full drop-shadow-lg z-10" />
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-black italic leading-none mb-1">{tenant?.name}</h1>
            <p className={`font-medium tracking-widest uppercase text-[8px] mt-2 flex items-center justify-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <MapPin size={9} style={{ color: primaryColor }} /> Sistema Multi-Tenant
            </p>
          </div>

          {showResetPassword ? (
            <div className="w-full flex flex-col items-center space-y-4 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-black uppercase text-center w-full mb-2">Recuperar Contraseña</h2>
              {resetSuccess ? (
                <div className="w-full bg-green-500/10 border border-green-500/20 p-4 rounded-2xl text-center">
                  <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                  <p className="text-green-500 text-xs font-bold">¡Correo enviado con éxito!</p>
                  <p className="text-[10px] text-slate-400 mt-2">Revisa tu bandeja de entrada o spam y sigue las instrucciones del correo.</p>
                  <button onClick={() => { setShowResetPassword(false); setResetSuccess(false); }} className="mt-4 text-xs font-bold underline" style={{ color: primaryColor }}>Volver a Inicio de Sesión</button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="w-full space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1 justify-center">
                      Correo del Administrador
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className={`w-full rounded-2xl p-4 font-bold outline-none text-center tracking-widest border transition-all ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500' : 'bg-slate-900 border-slate-800 text-white focus:border-white/20'
                      }`}
                      placeholder="ejemplo@correo.com"
                      required
                      disabled={loggingIn}
                    />
                  </div>
                  {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider animate-shake">{error}</p>}
                  
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="w-full py-4.5 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {loggingIn ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Correo de Recuperación'}
                  </button>
                  <div className="w-full text-center">
                    <button type="button" onClick={() => setShowResetPassword(false)} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors">Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* Selector de Roles Dinámico Filtrado por la Base de Datos */}
          <div className={`w-full p-1.5 rounded-2xl border flex flex-wrap justify-between gap-1 transition-colors ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
            {availableRoles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setSelectedRole(r); setError(''); }}
                className={`flex-1 min-w-[70px] py-2.5 px-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex flex-col items-center gap-1.5 ${
                  selectedRole === r
                    ? 'text-white shadow-md'
                    : isLight
                      ? 'text-slate-500 hover:text-slate-800'
                      : 'text-slate-500 hover:text-slate-300'
                }`}
                style={selectedRole === r ? { backgroundColor: primaryColor } : {}}
              >
                {r === 'admin' && <Shield size={13} />}
                {r === 'staff' && <ShoppingBag size={13} />}
                {r === 'kitchen' && <ChefHat size={13} />}
                {r === 'bartender' && <GlassWater size={13} />}
                {r === 'delivery' && <Navigation size={13} />}
                {r === 'waiter' && <Bell size={13} />}
                {r === 'animador' && <ShieldAlert size={13} />}
                
                {r === 'admin' ? 'Admin' : r === 'staff' ? 'Caja' : r === 'kitchen' ? 'Cocina' : r === 'bartender' ? 'Barra' : r === 'waiter' ? 'Mozo' : r === 'animador' ? 'Animador' : 'Envíos'}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-5">
            {selectedRole !== 'admin' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2 flex items-center gap-1 justify-center">
                  ¿Quién eres?
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className={`w-full rounded-2xl p-4 font-bold outline-none text-center tracking-widest border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-slate-900 border-slate-800 text-white focus:border-white/20'
                  }`}
                  disabled={loggingIn}
                >
                  <option value="">-- Seleccionar Nombre --</option>
                  {employees.filter(e => e.role === selectedRole).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2 flex items-center gap-1 justify-center">
                <Lock size={10} style={{ color: primaryColor }} /> Clave para {selectedRole === 'admin' ? 'Administrador' : 'acceder'}
              </label>
              <input
                type={selectedRole === 'admin' ? "password" : "text"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-2xl p-4 font-bold outline-none text-center tracking-widest border transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500'
                    : 'bg-slate-900 border-slate-800 text-white focus:border-white/20'
                }`}
                placeholder="****"
                disabled={loggingIn}
              />
            </div>
            {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider animate-shake">{error}</p>}
            
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-4.5 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
              style={{ backgroundColor: primaryColor }}
            >
              {loggingIn ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {selectedRole === 'admin' && (
            <button
              type="button"
              onClick={() => { setShowResetPassword(true); setResetEmail(tenant?.email || ''); setError(''); }}
              className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors underline -mt-2"
            >
              Olvidé mi contraseña
            </button>
          )}

          <Link href="/" className={`text-[8px] uppercase font-black tracking-widest transition-colors ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-500 hover:text-white'}`}>
            ← Cambiar de Local
          </Link>
          </>
          )}
          
          <div className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity pt-2">
             <img src="/maxes-clan-logo.jpg" alt="Maxes Clan Logo" className="h-5 object-contain rounded opacity-80" style={{ filter: isLight ? 'invert(1)' : 'none' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-28 transition-colors ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'}`}>
      
      {/* Header General de la App */}
      
      {isSupported && !isSubscribed && profile.role !== 'admin' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex justify-between items-center shadow-md">
          <span>Activa las notificaciones para recibir pedidos</span>
          <button 
            onClick={async () => {
              const success = await subscribeToPush();
              if (success) {
                alert('¡Excelente! Las notificaciones se han activado con éxito en este dispositivo.');
              } else {
                alert('Hubo un problema al activar las notificaciones. Verifica los permisos de tu navegador.');
              }
            }} 
            className="bg-white text-amber-600 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
          >
            Permitir
          </button>
        </div>
      )}
      
      {isSupported && !isSubscribed && profile.role === 'admin' && (
        <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold flex justify-between items-center shadow-md">
          <span>Activa las notificaciones para alertas de stock</span>
          <button 
            onClick={async () => {
              const success = await subscribeToPush();
              if (success) {
                alert('¡Excelente! Las alertas de stock se activaron con éxito en este dispositivo.');
              } else {
                alert('Hubo un problema al activar las notificaciones. Verifica los permisos de tu navegador.');
              }
            }} 
            className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
          >
            Permitir
          </button>
        </div>
      )}

      {/* Banner de éxito (Oculto por defecto, se muestra 5s tras suscribir) */}
      <div id="push-success-banner" style={{display: 'none'}} className="bg-emerald-500 text-white px-4 py-2 text-xs font-bold flex justify-center items-center shadow-md animate-in slide-in-from-top-2">
         <span className="flex items-center gap-2">
            <CheckCircle2 size={16} /> ¡Notificaciones push activadas!
         </span>
      </div>

      {/* Aviso iOS (safari) sin PWA instalada */}
      {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !('standalone' in window.navigator && (window.navigator as any).standalone) && (
        <div className="bg-blue-500 text-white px-4 py-2 text-xs font-bold text-center shadow-md">
          Para recibir notificaciones en tu iPhone, toca Compartir y "Añadir a la pantalla de inicio".
        </div>
      )}

      <div className={`px-6 py-4 flex justify-between items-center border-b transition-colors ${
        isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-slate-950 border-white/5'
      }`}>
        <div className="flex items-center gap-3">
          {tenant.profile_picture_url ? (
            <img 
              src={tenant.profile_picture_url} 
              alt={tenant.name} 
              className="w-9 h-9 rounded-full object-cover shadow-md animate-scale-up border border-white/10"
            />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-black uppercase text-sm text-white shadow-md animate-scale-up" style={{ backgroundColor: primaryColor }}>
              {tenant.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-sm font-black italic uppercase leading-none">{tenant.name}</h1>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1 flex items-center gap-1">
              Sesión: <span style={{ color: primaryColor }}>{profile.full_name || 'Personal'}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button
            id="global-refresh-button"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing}
            className={`p-2 rounded-xl transition-all active:scale-90 ${
              isLight
                ? 'text-slate-600 bg-slate-200/50 hover:bg-slate-200 hover:text-slate-900'
                : 'text-slate-500 bg-slate-900/50 hover:bg-slate-900 hover:text-white'
            }`}
            title="Refrescar Datos"
          >
            <RefreshCw size={18} className={isManualRefreshing ? 'animate-spin text-amber-500' : ''} />
          </button>
          {activeTab !== 'delivery' && (
            <button
              onClick={() => {
                setShowNotificationOverlay(true);
                if (profile?.role === 'delivery') {
                  const deliveryNotifs = filteredNotifications.filter(
                    n => n.message.includes('Tienes un pedido nuevo') || n.message.includes('Tienes un pedido para entregar')
                  );
                  deliveryNotifs.forEach(n => removeNotification(n.id, tenant?.id));
                }
              }}
              className={`relative p-2 rounded-xl transition-all active:scale-90 ${
                isLight
                  ? 'text-slate-600 bg-slate-200/50 hover:bg-slate-200 hover:text-slate-900'
                  : 'text-slate-500 bg-slate-900/50 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Bell size={18} />
              {filteredNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 text-slate-900 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce bg-yellow-500">
                  {filteredNotifications.length}
                </span>
              )}
            </button>
          )}
          {isOnline ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-500" />}
          <button
            onClick={async () => {
              if (profile && tenant?.id) {
                const storedFingerprint = localStorage.getItem(`device_fingerprint_${tenant.id}`);
                if (storedFingerprint) {
                  // Liberar sesión de la base de datos
                  await supabase.from('active_devices').delete().eq('device_fingerprint', storedFingerprint);
                  localStorage.removeItem(`device_fingerprint_${tenant.id}`);
                }
              }
              localStorage.removeItem(`active_profile_${tenant.id}`);
              setProfile(null);
              setPassword('');
              setDeviceFingerprint(null);
            }}
            className={`p-2 rounded-xl transition-all ${
              isLight
                ? 'text-slate-600 bg-slate-200/50 hover:bg-slate-200 hover:text-slate-900'
                : 'text-slate-500 bg-slate-900/50 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className="animate-in fade-in duration-500">
        <div>
          {activeTab === 'orders' && (
            <OrderTab 
              products={products} 
              ingredients={ingredients} 
              productIngredients={productIngredients} 
              categories={categories} 
              orders={orders} 
              expenses={expenses}
              tenant={tenant}
              productOffers={productOffers}
              isLight={isLight}
              refetchData={refetch}
            />
          )}
        </div>
        <div>{activeTab === 'kitchen' && <PreparationTab orders={orders} products={products} tenant={tenant} refetchData={refetch} />}</div>
        <div>{activeTab === 'delivery' && <DeliveryTab orders={orders} products={products} tenantColors={tenant?.theme_colors} tenant={tenant} currentEmployee={profile} />}</div>
        <div>
          {activeTab === 'admin' && profile.role === 'admin' && (
            <AdminTab
              products={products}
              categories={categories}
              ingredients={ingredients}
              orders={orders}
              expenses={expenses}
              productIngredients={productIngredients}
              ingredientBatches={ingredientBatches}
              productOffers={productOffers}
              tenant={tenant}
              onTenantUpdate={(updatedTenant: any) => setTenant(updatedTenant)}
              refetchData={refetch}
              planFeatures={planFeatures}
            />
          )}
        </div>
          <div className="pb-32">
            <GlobalWatermark />
          </div>
      </main>

        {(profile.role === 'admin' || profile.role === 'staff') && (
          <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:max-w-lg rounded-[2.5rem] p-2 flex justify-between shadow-2xl z-50 border transition-all duration-500 ${
            isLight
              ? 'bg-white/95 border-slate-200/80 backdrop-blur-md shadow-slate-200/50 text-slate-900'
              : 'glass border-white/10 text-white'
          }`}>
            {availableRoles.includes('staff') && (
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${
                  activeTab === 'orders' ? 'text-white shadow-lg animate-scale-up' : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={activeTab === 'orders' ? { backgroundColor: primaryColor } : {}}
              >
                <ShoppingBag size={18} /><span className="text-[8px] font-black uppercase mt-1">Pedidos</span>
              </button>
            )}
            
            {availableRoles.includes('kitchen') && (
              <button
                onClick={() => setActiveTab('kitchen')}
                className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${
                  activeTab === 'kitchen' ? 'text-white shadow-lg animate-scale-up' : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={activeTab === 'kitchen' ? { backgroundColor: primaryColor } : {}}
              >
                <ChefHat size={18} /><span className="text-[8px] font-black uppercase mt-1">Cocina</span>
              </button>
            )}


            {availableRoles.includes('delivery') && (
              <button
                onClick={() => setActiveTab('delivery')}
                className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${
                  activeTab === 'delivery' ? 'text-white shadow-lg animate-scale-up' : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={activeTab === 'delivery' ? { backgroundColor: primaryColor } : {}}
              >
                <Navigation size={18} /><span className="text-[8px] font-black uppercase mt-1">Despacho</span>
              </button>
            )}


            {profile.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${
                  activeTab === 'admin' ? 'text-white shadow-lg animate-scale-up' : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={activeTab === 'admin' ? { backgroundColor: primaryColor } : {}}
              >
                <Settings size={18} /><span className="text-[8px] font-black uppercase mt-1">Admin</span>
              </button>
            )}
          </nav>
        )}

        {/* Notifications Overlay */}
        {showNotificationOverlay && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className={`w-full max-w-sm rounded-[2.5rem] p-6 space-y-4 shadow-2xl border flex flex-col max-h-[80vh] transition-colors ${
              isLight ? 'bg-white border-slate-200' : 'glass border-white/10'
            }`}>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-black uppercase italic" style={{ color: primaryColor }}>Notificaciones</h3>
                  {filteredNotifications.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("¿Estás seguro de que deseas limpiar todas las notificaciones?")) {
                          clearAll(tenant?.id);
                        }
                      }}
                      className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                    >
                      Limpiar Todo
                    </button>
                  )}
                </div>
                <button onClick={() => setShowNotificationOverlay(false)} className="text-slate-500 p-2 hover:text-slate-300"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {filteredNotifications.length === 0 ? (
                  <div className={`py-12 text-center font-bold uppercase text-[10px] tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                    No hay notificaciones
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Stock Bajo */}
                    {filteredNotifications.filter(n => n.type === 'alert').length > 0 && (
                      <details className="group">
                        <summary className="flex items-center justify-between p-3 rounded-2xl bg-red-500/10 border border-red-500/30 cursor-pointer list-none">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-500" size={16} />
                            <span className="text-red-500 font-black text-xs uppercase">Stock Bajo ({filteredNotifications.filter(n => n.type === 'alert').length})</span>
                          </div>
                        </summary>
                        <div className="mt-2 space-y-2 pl-2">
                          {filteredNotifications.filter(n => n.type === 'alert').map(n => (
                            <div key={n.id} className="flex justify-between items-center p-2 rounded-xl bg-red-500/5 border border-red-500/10">
                              <span className="text-xs text-red-400 font-bold">{n.message}</span>
                              <button onClick={() => removeNotification(n.id)} className="text-red-500/50 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                     {/* Seguimiento en Vivo (Live Tracking) - Exclusivo para Admin y Staff de Caja */}
                     {(profile?.role === 'admin' || profile?.role === 'staff') && (
                       <div className="space-y-4">
                           <div className="p-4 rounded-3xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                                       <Clock size={16} className="animate-pulse" />
                                   </div>
                                   <div>
                                       <span className="text-yellow-500 font-black text-xs uppercase tracking-[0.2em]">Seguimiento en Vivo</span>
                                       <p className="text-[8px] font-black text-yellow-500/60 uppercase">Monitoreo de Comandas</p>
                                   </div>
                               </div>
                               <span className="text-[10px] font-black text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                                   {orders.filter(o => o.status === 'pending' && !o.is_archived).length} ACTIVOS
                               </span>
                           </div>

                           <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                               {orders.filter(o => o.status === 'pending' && !o.is_archived).length === 0 ? (
                                   <div className={`py-12 text-center font-bold uppercase text-[10px] tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                                       No hay pedidos en curso
                                   </div>
                               ) : (
                                   orders.filter(o => o.status === 'pending' && !o.is_archived).map(order => (
                                       <div key={order.id} className={`${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-white/5'} rounded-[2rem] p-5 border space-y-3 shadow-xl`}>
                                           <div className="flex justify-between items-start">
                                               <div>
                                                   <h4 className={`text-sm font-black italic leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                       <span className="text-amber-500 mr-1.5">#{order.order_number}</span> 
                                                       {order.client_name}
                                                   </h4>
                                                   <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Ingresado: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                               </div>
                                               <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-pulse" />
                                           </div>
                                           
                                           <div className={`space-y-1.5 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                                               {order.items?.map((item, idx) => {
                                                   const isDone = item.status === 'delivered';
                                                   return (
                                                       <div key={item.id || idx} className="flex justify-between items-center group">
                                                           <span className={`text-[11px] font-black tracking-tight flex items-center gap-2 ${
                                                               isDone ? (isLight ? 'text-slate-400 line-through' : 'text-slate-700 line-through') : (isLight ? 'text-slate-700' : 'text-slate-100')
                                                           }`}>
                                                               <span className={`text-[9px] w-5 h-5 rounded-lg flex items-center justify-center ${isDone ? (isLight ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-slate-700') : 'bg-amber-500/10 text-amber-500'}`}>
                                                                   {item.quantity}
                                                               </span>
                                                               {item.notes || item.product?.name || products.find(p => p.id === item.product_id)?.name || 'Producto'}
                                                           </span>
                                                           {isDone && <Check size={12} className={isLight ? 'text-slate-300' : 'text-slate-700'} />}
                                                       </div>
                                                   );
                                               })}
                                           </div>
                                       </div>
                                   ))
                               )}
                           </div>
                       </div>
                     )}

                    {/* Pedidos Completados */}
                    {filteredNotifications.filter(n => n.type === 'success').length > 0 && (
                      <details className="group">
                        <summary className="flex items-center justify-between p-3 rounded-2xl bg-green-500/10 border border-green-500/30 cursor-pointer list-none">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="text-green-500" size={16} />
                            <span className="text-green-500 font-black text-xs uppercase">Completados ({filteredNotifications.filter(n => n.type === 'success').length})</span>
                          </div>
                        </summary>
                        <div className="mt-2 space-y-2 pl-2">
                          {filteredNotifications.filter(n => n.type === 'success').map(n => (
                            <div key={n.id} className="flex justify-between items-center p-2 rounded-xl bg-green-500/5 border border-green-500/10">
                              <span className="text-xs text-green-400 font-bold">{n.message}</span>
                              <button onClick={() => removeNotification(n.id)} className="text-green-500/50 hover:text-green-500"><Trash2 size={12} /></button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => { clearAll(); setShowNotificationOverlay(false); }}
                className={`w-full py-3 text-[10px] font-black uppercase rounded-2xl transition-colors ${
                  isLight
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Limpiar Todo
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
