export type UserRole = 'admin' | 'staff' | 'kitchen' | 'delivery' | 'bartender' | 'waiter' | 'animador';

export interface Profile {
    id: string;
    full_name: string | null;
    role: UserRole;
}

export interface Category {
    id: string;
    name: string;
    icon: string | null;
    target_departments?: string[];
    is_offer?: boolean;
}

export interface Ingredient {
    id: string;
    name: string;
    stock_level: number;
    unit: string;
    min_stock_alert: number;
    unit_price: number;
    target_departments?: string[];
    barcode?: string;
    is_fractionable?: boolean;
    sale_by_weight?: boolean;
    base_weight?: number | null;
    base_weight_unit?: string | null;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category_id: string | null;
    category?: Category;
    is_active?: boolean;
    is_delivery_app_enabled?: boolean;
    external_product_id?: string;
    custom_question?: string | null;
    is_question_required?: boolean;
    sale_by_weight?: boolean;
    base_weight?: number | null;
    base_weight_unit?: string | null;
    barcode?: string | null;
    stock_level?: number | null;
    is_fractionable?: boolean;
}

export interface ProductIngredient {
    id: string;
    product_id: string;
    ingredient_id: string;
    quantity_used: number;
    ingredient?: Ingredient;
}


export type OrderStatus = 'pending' | 'in_preparation' | 'ready' | 'delivering' | 'completed' | 'delivered';

export interface Order {
    id: string;
    client_name: string;
    phone_number: string;
    status: OrderStatus;
    total_price: number;
    created_at: string;
    order_number?: number;
    payment_method?: string;
    payment_status?: string;
    is_archived?: boolean;
    items?: OrderItem[];
    table_number?: string;
    waiter_name?: string;
    
    // Opcionales para facturación AFIP solicitada por el cliente
    afip_billing_requested?: boolean;
    afip_client_type?: string;
    afip_doc_type?: string;
    afip_doc_number?: string;
    
    tenant_id?: string;
    origin?: string;
    external_order_id?: string;
    external_raw_data?: any;

    // Campos de Fidelización (Loyalty) mmmTodoLoQueQuiero 2026
    loyalty_discount_applied?: number;
    is_loyalty_processed?: boolean;
    discount_amount?: number;
    delivery_fee?: number;
    
    // Delivery Settlement
    is_delivery_paid?: boolean;
    delivery_type?: string;
    delivery_address?: string;
    delivery_lat?: number;
    delivery_lng?: number;

    // Tips and Table Charge
    tip_amount?: number;
    is_tip_paid?: boolean;
    table_charge?: number;
}

export interface LoyaltyAccount {
    id: string;
    tenant_id: string;
    phone_number: string;
    client_name?: string | null;
    balance: number;
    total_spent: number;
    total_orders: number;
    last_order_date: string;
    tier: 'bronce' | 'plata' | 'oro';
    created_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string | null;
    quantity: number;
    unit_price: number;
    status?: 'pending' | 'delivered';
    product?: Product;
    target_departments?: string[];
    notes?: string;
    is_served?: boolean;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    type: 'purchase' | 'salary' | 'service' | 'tax' | 'other' | 'rent' | 'waste';
    date: string;
}

export interface AppNotification {
    id: string;
    message: string;
    type: 'info' | 'alert' | 'success';
    target_roles: UserRole[];
    created_at: string;
}

export interface IngredientBatch {
    id: string;
    ingredient_id: string;
    quantity: number;
    expiration_date: string;
    tenant_id: string;
    created_at: string;
}

export interface ProductOffer {
    id: string;
    discount_percentage: number;
    start_date: string;
    end_date: string;
    limit_quantity?: number;
    product_ids: string[];
    tenant_id: string;
    created_at: string;
}

export interface Franchise {
    id: string;
    name: string;
    admin_email: string;
    created_at: string;
}

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    email: string;
    theme_colors?: any;
    enabled_roles?: UserRole[];
    location_lat?: number;
    location_lng?: number;
    tables?: any[];
    waiters?: any[];
    mercadopago_public_key?: string;
    has_delivery?: boolean;
    delivery_zones?: any[];
    profile_picture_url?: string;
    banner_url?: string;
    social_links?: any;
    reviews_enabled?: boolean;
    created_at: string;
    franchise_id?: string;
    max_devices?: number;
    landing_config?: any;
    tips_enabled?: boolean;
    table_charge_enabled?: boolean;
    table_charge_amount?: number;
}

export interface SocialInteraction {
    id: string;
    tenant_id: string;
    interaction_type: 'music_request' | 'announcement' | 'table_invite';
    from_table?: string;
    to_table?: string;
    is_anonymous?: boolean;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export interface Employee {
    id: string;
    tenant_id: string;
    name: string;
    role: UserRole;
    pin_code: string;
    created_at?: string;
}

export interface ActiveDevice {
    id: string;
    tenant_id: string;
    employee_id: string;
    device_fingerprint: string;
    user_agent: string;
    created_at?: string;
    employee?: Employee;
}
