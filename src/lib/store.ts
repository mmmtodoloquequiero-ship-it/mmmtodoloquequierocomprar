import { create } from 'zustand'
import { supabase, broadcastTenantChange } from './supabase'
import { UserRole } from '@/types/database';

interface NotificationStore {
    addNotification: (message: string, target_roles: UserRole[], type?: 'info' | 'alert' | 'success', tenantId?: string) => Promise<void>;
    removeNotification: (id: string, tenantId?: string) => Promise<void>;
    clearAll: (tenantId?: string) => Promise<void>;
}

export const useNotifications = create<NotificationStore>(() => ({
    addNotification: async (message: string, target_roles: UserRole[], type = 'info', tenantId?: string) => {
        const insertPayload: any = {
            message,
            type,
            target_roles
        };
        if (tenantId) {
            insertPayload.tenant_id = tenantId;
        }
        const { error } = await supabase.from('app_notifications').insert([insertPayload]);
        if (error) {
            console.error('Error adding notification:', error);
        } else if (tenantId) {
            broadcastTenantChange(tenantId);
            
            // 🔥 Enviar Notificaciones Web Push a cada rol objetivo
            target_roles.forEach(role => {
                fetch('/api/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: tenantId,
                        role,
                        title: 'Mmm TodoLoQueQuiero Comer',
                        body: message
                    })
                }).catch(err => console.error('Error enviando push:', err));
            });
        }
    },
    removeNotification: async (id: string, tenantId?: string) => {
        const { error } = await supabase.from('app_notifications').delete().eq('id', id);
        if (error) {
            console.error('Error removing notification:', error);
        } else if (tenantId) {
            broadcastTenantChange(tenantId);
        }
    },
    clearAll: async (tenantId?: string) => {
        const query = supabase.from('app_notifications').delete();
        const { error } = tenantId 
            ? await query.eq('tenant_id', tenantId) 
            : await query.neq('id', '00000000-0000-0000-0000-000000000000');
            
        if (error) {
            console.error('Error clearing notifications:', error);
        } else if (tenantId) {
            broadcastTenantChange(tenantId);
        }
    },
}))
