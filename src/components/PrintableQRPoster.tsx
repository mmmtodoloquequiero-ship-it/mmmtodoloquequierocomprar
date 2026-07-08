import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PrintableQRPosterProps {
    tenant: any;
}

export const PrintableQRPoster = React.forwardRef<HTMLDivElement, PrintableQRPosterProps>(({ tenant }, ref) => {
    if (!tenant) return null;

    const tenantSlug = tenant?.slug || '';
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/${tenantSlug}` : `https://mymenulocal.com/${tenantSlug}`;

    return (
        <div style={{ display: 'none' }}>
            <div
                ref={ref}
                className="print-qr-poster"
                style={{
                    padding: '20px',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    color: '#000',
                    width: '100%',
                    maxWidth: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    boxSizing: 'border-box'
                }}
            >
                <style>
                    {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .print-qr-poster, .print-qr-poster * {
                            visibility: visible;
                        }
                        .print-qr-poster {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            display: flex !important;
                            justify-content: center !important;
                            align-items: center !important;
                            flex-direction: column !important;
                            padding: 2cm !important;
                        }
                    }
                    `}
                </style>
                
                <h1 style={{ fontSize: '48px', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                    {tenant.name || 'Menú Digital'}
                </h1>
                
                <p style={{ fontSize: '24px', margin: '0 0 40px 0', fontWeight: 'bold' }}>
                    ¡Escaneá el código para ver nuestro menú!
                </p>

                <div style={{ padding: '20px', border: '8px solid #000', borderRadius: '20px', background: '#fff' }}>
                    <QRCodeSVG value={publicUrl} size={350} />
                </div>

                <p style={{ marginTop: '40px', fontSize: '18px', fontWeight: 'bold', wordBreak: 'break-all' }}>
                    {publicUrl}
                </p>
                
                <p style={{ marginTop: '20px', fontSize: '14px', fontStyle: 'italic' }}>
                    Pedí desde tu celular sin esperar.
                </p>
            </div>
        </div>
    );
});

PrintableQRPoster.displayName = 'PrintableQRPoster';
