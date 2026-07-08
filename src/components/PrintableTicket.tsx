import React from 'react';
import { Order } from '@/types/database';
import { QRCodeSVG } from 'qrcode.react';

interface PrintableTicketProps {
    order: Order | null;
    tenant: any;
    products?: any[];
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

export const PrintableTicket = React.forwardRef<HTMLDivElement, PrintableTicketProps>(({ order, tenant, products = [] }, ref) => {
    if (!order) return null;

    // Determine type
    const isDelivery = (order as any).delivery_type === 'delivery' || (!order.table_number && order.client_name);
    const tenantSlug = tenant?.slug || '';
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/${tenantSlug}` : `https://mymenulocal.com/${tenantSlug}`;

    // Generar datos para el QR de AFIP si está facturado
    let afipQrUrl = '';
    const isFacturado = !!(order as any).afip_cae;
    
    if (isFacturado) {
        const afipData = {
            ver: 1,
            fecha: new Date(order.created_at).toISOString().split('T')[0],
            cuit: parseInt((tenant as any)?.afip_cuit?.replace(/-/g, '') || '0'),
            ptoVta: (order as any).afip_punto_venta || 1,
            tipoCmp: (order as any).afip_tipo_comprobante || 11,
            nroCmp: (order as any).afip_numero_comprobante || 0,
            importe: order.total_price || 0,
            moneda: 'PES',
            ctz: 1,
            tipoDocRec: (order as any).afip_doc_tipo || 99,
            nroDocRec: parseInt((order as any).afip_doc_nro || '0'),
            tipoCodAut: 'E',
            codAut: parseInt((order as any).afip_cae)
        };
        const base64Data = btoa(JSON.stringify(afipData));
        afipQrUrl = `https://www.afip.gob.ar/fe/qr/?p=${base64Data}`;
    }

    return (
        <div style={{ display: 'none' }}>
            <div
                ref={ref}
                style={{
                    padding: '10px',
                    width: '58mm',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#000',
                    background: '#fff',
                    margin: '0 auto'
                }}
                className="print-ticket-container"
            >
                <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px dashed #000', paddingBottom: '5px' }}>
                    <h2 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {tenant?.name || 'Local'}
                    </h2>
                    {!isFacturado && (
                        <div style={{ marginBottom: '5px' }}>
                            <p style={{ margin: '2px 0 0', fontSize: '10px', textAlign: 'center' }}>Comprobante no válido como factura</p>
                            {(order as any).afip_doc_nro && (order as any).afip_doc_nro !== '0' && (
                                <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 'bold' }}>
                                    {(order as any).afip_doc_tipo === 80 ? 'CUIT' : 'DNI'}: {(order as any).afip_doc_nro}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '10px' }}>
                    {isFacturado && (
                        <div style={{ border: '1px solid #000', padding: '2px', marginBottom: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                            <p style={{ margin: '0', fontSize: '12px' }}>
                                FACTURA {(order as any).afip_tipo_comprobante === 6 ? 'B' : (order as any).afip_tipo_comprobante === 11 ? 'C' : 'A'}
                            </p>
                            <p style={{ margin: '0', fontSize: '10px' }}>
                                Nro: {String((order as any).afip_punto_venta).padStart(4, '0')}-{String((order as any).afip_numero_comprobante).padStart(8, '0')}
                            </p>
                            {(order as any).afip_doc_nro && (order as any).afip_doc_nro !== '0' && (
                                <p style={{ margin: '2px 0 0', fontSize: '10px' }}>
                                    {(order as any).afip_doc_tipo === 80 ? 'CUIT' : 'DNI'}: {(order as any).afip_doc_nro}
                                </p>
                            )}
                        </div>
                    )}
                    <p style={{ margin: '2px 0' }}><strong>Fecha:</strong> {new Date(order.created_at).toLocaleString('es-AR')}</p>
                    <p style={{ margin: '2px 0' }}><strong>Pedido:</strong> #{order.order_number || order.id?.substring(0, 4)}</p>
                    {isDelivery ? (
                        <>
                            <p style={{ margin: '2px 0' }}><strong>Cliente:</strong> {order.client_name}</p>
                            {order.phone_number && <p style={{ margin: '2px 0' }}><strong>Tel:</strong> {order.phone_number}</p>}
                            {(order as any).delivery_address && <p style={{ margin: '2px 0' }}><strong>Dir:</strong> {(order as any).delivery_address}</p>}
                        </>
                    ) : (
                        <p style={{ margin: '2px 0', fontSize: '14px', fontWeight: 'bold' }}>
                            Mesa: {order.table_number}
                        </p>
                    )}
                </div>

                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '5px' }}>
                        <span>Cant. Item</span>
                        <span>Precio</span>
                    </div>
                    {order.items?.map((item: any, idx: number) => {
                        const prodName = (item.product as any)?.name || products.find(p => p.id === item.product_id)?.name || 'Producto';
                        return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                <span style={{ flex: 1, paddingRight: '5px' }}>
                                    {item.quantity}x {prodName}
                                    {item.notes && <div style={{ fontSize: '10px', marginLeft: '10px' }}>- {item.notes}</div>}
                                </span>
                                <span>{formatARS(item.unit_price * item.quantity)}</span>
                            </div>
                        );
                    })}
                </div>

                <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                    {isDelivery && (order as any).delivery_cost > 0 && (
                        <p style={{ margin: '2px 0' }}>Envío: {formatARS((order as any).delivery_cost)}</p>
                    )}
                    <h3 style={{ margin: '5px 0 0', fontSize: '16px' }}>Total: {formatARS(order.total_price)}</h3>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    {isFacturado ? (
                        <>
                            <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: 'bold' }}>Comprobante Autorizado por AFIP</p>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <QRCodeSVG value={afipQrUrl} size={100} />
                            </div>
                            <p style={{ margin: '5px 0 0', fontSize: '9px' }}>CAE: {(order as any).afip_cae}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '9px' }}>Vto CAE: {new Date((order as any).afip_cae_vencimiento || order.created_at).toLocaleDateString('es-AR')}</p>
                        </>
                    ) : (
                        <>
                            <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: 'bold' }}>¡Escaneá y mirá nuestro menú!</p>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <QRCodeSVG value={publicUrl} size={100} />
                            </div>
                            <p style={{ margin: '5px 0 0', fontSize: '9px' }}>{publicUrl}</p>
                        </>
                    )}
                </div>
            </div>
            {/* Agregamos una regla global temporal en print para forzar estilos */}
            <style>{`
                @media print {
                    @page { margin: 0; }
                    body * { visibility: hidden; }
                    .print-ticket-container, .print-ticket-container * { visibility: visible; }
                    .print-ticket-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 58mm;
                        padding: 0;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
});

PrintableTicket.displayName = 'PrintableTicket';
