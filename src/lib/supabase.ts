import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const clientsCache: Record<string, SupabaseClient> = {};
let activeTenantId: string | null = null;
let activeSessionId: string | null = null;

function getClient(): SupabaseClient {
  const key = `${activeTenantId || 'default'}-${activeSessionId || 'none'}`;
  if (!clientsCache[key]) {
    const headers: Record<string, string> = {};
    if (activeTenantId) headers['x-tenant-id'] = activeTenantId;
    if (activeSessionId) headers['x-tenant-session'] = activeSessionId;
    
    clientsCache[key] = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers
      }
    });
  }
  return clientsCache[key];
}

// Exportamos supabase como un Proxy para que actúe dinámicamente según el tenant activo,
// manteniendo la compatibilidad exacta con todas las importaciones existentes.
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Cliente completamente anónimo y limpio de cabeceras para operaciones públicas y transversales
// (como resolver el slug de un local a su ID).
export const supabaseAnon = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = clientsCache['default'] || (clientsCache['default'] = createClient(supabaseUrl, supabaseAnonKey));
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export function setSupabaseTenant(tenantId: string | null, sessionId?: string | null) {
  activeTenantId = tenantId;
  if (sessionId !== undefined) {
    activeSessionId = sessionId;
  }
}


export function broadcastTenantChange(tenantId: string | null) {
  if (!tenantId) return;
  const client = getClient();
  const channel = client.channel(`tenant-room-${tenantId}`, {
    config: {
      broadcast: { self: true } // Permitir broadcast al mismo cliente si fuese necesario
    }
  });
  
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'schema-update',
        payload: { timestamp: Date.now() }
      }).then(() => {
        // Remover el canal después de 1.5 segundos para no dejar conexiones huérfanas
        setTimeout(() => {
          try {
            client.removeChannel(channel);
          } catch (e) {
            console.error('Error removing realtime channel:', e);
          }
        }, 1500);
      });
    }
  });
}
