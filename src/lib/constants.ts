
export const PRESET_IMAGES = [
    { url: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Almacén" },
    { url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Gaseosa" },
    { url: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Snacks" },
    { url: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Golosinas" },
    { url: "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Chocolates" },
    { url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Galletitas" },
    { url: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Cerveza" },
    { url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Panadería" },
    { url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Vinos" },
    { url: "https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Helados" },
    { url: "https://images.unsplash.com/photo-1599508704512-2f19efd1e40f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Lácteos" },
];

export const NEON_ICONS = [
    { icon: '🏪', name: 'Almacén' },
    { icon: '🥤', name: 'Bebidas' },
    { icon: '🍞', name: 'Panadería' },
    { icon: '🍫', name: 'Chocolates' },
    { icon: '🍬', name: 'Golosinas' },
    { icon: '🍪', name: 'Galletitas' },
    { icon: '🧀', name: 'Fiambrería' },
    { icon: '🍎', name: 'Verdulería' },
    { icon: '🧼', name: 'Limpieza' },
    { icon: '🍦', name: 'Helados' },
    { icon: '🍿', name: 'Snacks' },
    { icon: '🍺', name: 'Cerveza' },
    { icon: '🍷', name: 'Vinos' },
    { icon: '🏷️', name: 'Oferta' },
    { icon: '🛍️', name: 'Bolsa' },
];

export const INITIAL_CATEGORIES = [
    { id: '1', name: 'Hamburguesas', icon: '🍔' },
    { id: '2', name: 'Panchos', icon: '🌭' },
    { id: '3', name: 'Combos', icon: '🍔🍟🥤' },
    { id: '4', name: 'Bebidas', icon: '🥤' }
];

export const INITIAL_INGREDIENTS = [
    { id: '1', name: 'Pan de Burger', stockLevel: 50, unit: 'uds', minStockAlert: 10, unitPrice: 150 },
    { id: '2', name: 'Carne Molida', stockLevel: 10, unit: 'kg', minStockAlert: 2, unitPrice: 3500 },
    { id: '3', name: 'Queso Cheddar', stockLevel: 5, unit: 'kg', minStockAlert: 1, unitPrice: 4200 },
    { id: '4', name: 'Lechuga', stockLevel: 3, unit: 'kg', minStockAlert: 0.5, unitPrice: 1000 },
    { id: '5', name: 'Tomate', stockLevel: 4, unit: 'kg', minStockAlert: 1, unitPrice: 1200 },
    { id: '6', name: 'Harina', stockLevel: 20, unit: 'kg', minStockAlert: 5, unitPrice: 800 },
    { id: '7', name: 'Coca Cola 1.5L', stockLevel: 24, unit: 'uds', minStockAlert: 6, unitPrice: 900 },
];

export const INITIAL_PRODUCTS = [
    {
        id: '1',
        name: 'Burger Clásica',
        price: 3500,
        categoryId: '1',
        description: 'Doble carne, queso cheddar, lechuga y tomate',
        imageUrl: PRESET_IMAGES[0].url,
        ingredients: [
            { ingredientId: '1', quantityUsed: 1 },
            { ingredientId: '2', quantityUsed: 0.150 },
            { ingredientId: '3', quantityUsed: 0.050 },
            { ingredientId: '4', quantityUsed: 0.020 },
        ]
    },
    {
        id: '2',
        name: 'Pizza Muzzarella',
        price: 4200,
        categoryId: '2',
        description: 'Salsa de tomate, muzzarella y orégano',
        imageUrl: PRESET_IMAGES[4].url,
        ingredients: [
            { ingredientId: '6', quantityUsed: 0.300 },
            { ingredientId: '3', quantityUsed: 0.250 },
        ]
    },
    {
        id: '3',
        name: 'Coca Cola 1.5L',
        price: 1500,
        categoryId: '3',
        description: 'Botella de 1.5 litros',
        imageUrl: PRESET_IMAGES[9].url,
        ingredients: [
            { ingredientId: '7', quantityUsed: 1 }
        ]
    }
];
