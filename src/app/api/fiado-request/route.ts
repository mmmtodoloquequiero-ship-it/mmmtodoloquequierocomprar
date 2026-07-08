import { NextResponse } from 'next/server';


export async function GET(request: Request) {
    // Obtenemos la IP de los headers de Vercel/Next.js
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'IP Desconocida';
    
    // Obtenemos el User Agent
    const userAgent = request.headers.get('user-agent') || 'Desconocido';

    return NextResponse.json({ ip, userAgent });
}
