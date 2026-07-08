import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';

interface OfflineOrder {
    id: string;
    client_name: string;
    phone_number: string;
    total_price: number;
    table_number?: string | null;
    waiter_name?: string | null;
    payment_method?: string;
    payment_status?: string;
    is_approved_for_production?: boolean;
    delivery_type?: string;
    tenant_id?: string;
    items: {
        product_id: string;
        quantity: number;
        unit_price: number;
    }[];
    status: 'pending-sync' | 'syncing' | 'failed';
    created_at: string;
}

interface OfflineStore {
    queue: OfflineOrder[];
    addToQueue: (order: Omit<OfflineOrder, 'id' | 'status' | 'created_at'>) => void;
    removeFromQueue: (id: string) => void;
    updateStatus: (id: string, status: OfflineOrder['status']) => void;
    syncQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set, get) => ({
            queue: [],
            addToQueue: (order) => {
                const newOrder: OfflineOrder = {
                    ...order,
                    id: Math.random().toString(36).substring(7),
                    status: 'pending-sync',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ queue: [...state.queue, newOrder] }));
            },
            removeFromQueue: (id) => {
                set((state) => ({ queue: state.queue.filter(o => o.id !== id) }));
            },
            updateStatus: (id, status) => {
                set((state) => ({
                    queue: state.queue.map(o => o.id === id ? { ...o, status } : o)
                }));
            },
            syncQueue: async () => {
                const { queue, updateStatus, removeFromQueue } = get();
                const pending = queue.filter(o => o.status === 'pending-sync' || o.status === 'failed');

                for (const order of pending) {
                    try {
                        updateStatus(order.id, 'syncing');

                        // 1. Create order
                        const { data: remoteOrder, error: orderError } = await supabase
                            .from('orders')
                            .insert({
                                client_name: order.client_name,
                                phone_number: order.phone_number,
                                total_price: order.total_price,
                                status: 'pending',
                                created_at: order.created_at,
                                table_number: order.table_number,
                                waiter_name: order.waiter_name,
                                payment_method: order.payment_method || 'efectivo',
                                payment_status: order.payment_status || 'pagado',
                                is_approved_for_production: order.is_approved_for_production ?? true,
                                delivery_type: order.delivery_type || 'local',
                                tenant_id: order.tenant_id
                            })
                            .select()
                            .single();

                        if (orderError) throw orderError;

                        // 2. Create items (simplificado)
                        const items = order.items.map(i => ({
                            order_id: remoteOrder.id,
                            product_id: i.product_id,
                            quantity: i.quantity,
                            unit_price: i.unit_price,
                            tenant_id: order.tenant_id,
                            status: 'pending',
                            target_departments: ['kitchen'] // Por defecto
                        }));

                        const { error: itemsError } = await supabase
                            .from('order_items')
                            .insert(items);

                        if (itemsError) throw itemsError;

                        // 3. Notification
                        await supabase.from('app_notifications').insert([{
                            message: `Nuevo pedido de ${order.client_name} #${remoteOrder.order_number} (Sincronizado Offline)`,
                            type: 'info',
                            target_roles: ['kitchen', 'admin'],
                            tenant_id: order.tenant_id
                        }]);

                        removeFromQueue(order.id);
                    } catch (error) {
                        console.error('Error syncing order:', error);
                        updateStatus(order.id, 'failed');
                    }
                }
            }
        }),
        {
            name: 'offline-orders-storage',
        }
    )
);
