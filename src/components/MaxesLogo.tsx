import React from 'react';

interface MaxesLogoProps {
    appName?: string;
    showPoweredBy?: boolean;
    className?: string;
    scale?: number;
}

export const MaxesLogo: React.FC<MaxesLogoProps> = ({ 
    appName = "MyMfullcontrol", 
    showPoweredBy = false,
    className = "",
    scale = 1
}) => {
    return (
        <div className={`flex flex-col items-center justify-center ${className}`} style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
            {/* Contenedor del Logo de Victoria con el branding en el centro */}
            <div className="relative flex items-center justify-center w-48 h-48 select-none pointer-events-none">
                {/* SVG del Logo de Victoria: Representación geométrica pura y limpia de la posición de Victoria (cuatro palitos o rectángulos redondeados con un vacío central) */}
                <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_20px_rgba(212,175,55,0.25)]">
                    <defs>
                        {/* Degradado metálico dorado premium */}
                        <linearGradient id="gold-metallic" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF7D6" />
                            <stop offset="25%" stopColor="#E6C27A" />
                            <stop offset="50%" stopColor="#D4AF37" />
                            <stop offset="75%" stopColor="#AA8222" />
                            <stop offset="100%" stopColor="#805F13" />
                        </linearGradient>
                    </defs>
                    
                    {/* BRAZOS (Dos barras superiores en forma de V) */}
                    {/* Brazo Izquierdo (Codo a Mano) */}
                    <line 
                        x1="70" y1="85" 
                        x2="30" y2="45" 
                        stroke="url(#gold-metallic)" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                    />
                    
                    {/* Brazo Derecho (Codo a Mano) */}
                    <line 
                        x1="130" y1="85" 
                        x2="170" y2="45" 
                        stroke="url(#gold-metallic)" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                    />
                    
                    {/* PIERNAS (Dos barras inferiores en forma de V invertida) */}
                    {/* Pierna Izquierda (Rodilla a Pie) */}
                    <line 
                        x1="75" y1="115" 
                        x2="35" y2="155" 
                        stroke="url(#gold-metallic)" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                    />
                    
                    {/* Pierna Derecha (Rodilla a Pie) */}
                    <line 
                        x1="125" y1="115" 
                        x2="165" y2="155" 
                        stroke="url(#gold-metallic)" 
                        strokeWidth="14" 
                        strokeLinecap="round" 
                    />
                </svg>

                {/* Texto Central: Se asienta elegantemente en el vacío del torso borrado */}
                <div className="absolute z-10 flex flex-col items-center justify-center text-center mt-[-2px]">
                    <span className="text-[9px] font-black tracking-[0.25em] text-[#D4AF37] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
                        mmmTodoLoQueQuiero
                    </span>
                    <span className="text-lg font-black tracking-widest text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]" style={{ fontFamily: 'system-ui, sans-serif' }}>
                        {appName.replace('MyM', '')}
                    </span>
                </div>
            </div>

            {/* Crédito de marca para mayor presencia premium */}
            {showPoweredBy && (
                <div className="mt-2 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
                    <span className="text-[10px] font-black text-white tracking-widest uppercase">
                        MAXES <span className="text-[#D4AF37]">Clan</span>
                    </span>
                </div>
            )}
        </div>
    );
};

export const MaxesWatermark = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
            {/* Marca de agua de fondo: 4 barras ("liñitas al agua") ubicadas en los 4 extremos de la pantalla (celular o monitor) */}
            {/* Dos liñitas arriba */}
            <div className="absolute top-6 left-6 w-3 h-20 bg-white/[0.03] -rotate-45 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.01)]" />
            <div className="absolute top-6 right-6 w-3 h-20 bg-white/[0.03] rotate-45 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.01)]" />
            
            {/* Dos liñitas abajo */}
            <div className="absolute bottom-6 left-6 w-3 h-20 bg-white/[0.03] rotate-45 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.01)]" />
            <div className="absolute bottom-6 right-6 w-3 h-20 bg-white/[0.03] -rotate-45 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.01)]" />
        </div>
    );
};

interface MaxesCornerFrameProps {
    color?: 'gold' | 'white' | 'red';
    opacity?: string;
    className?: string;
}

export const MaxesCornerFrame: React.FC<MaxesCornerFrameProps> = ({
    color = "gold",
    opacity = "opacity-40",
    className = ""
}) => {
    const bgClass = color === "gold"
        ? "bg-gradient-to-b from-[#E6C27A] to-[#AA8222]"
        : color === "red"
        ? "bg-gradient-to-b from-red-500 to-red-800"
        : "bg-white/40";

    const shadowClass = color === "gold"
        ? "shadow-[0_0_8px_rgba(212,175,55,0.3)]"
        : color === "red"
        ? "shadow-[0_0_8px_rgba(239,68,68,0.3)]"
        : "shadow-[0_0_8px_rgba(255,255,255,0.1)]";

    return (
        <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[inherit] ${opacity} ${className}`}>
            {/* En las esquinas del rectángulo (card/recuadro) se muestran las 4 barras del logo */}
            {/* Esquina superior izquierda */}
            <div className={`absolute top-3 left-3 w-1.5 h-8 ${bgClass} ${shadowClass} -rotate-45 rounded-full`} />
            {/* Esquina superior derecha */}
            <div className={`absolute top-3 right-3 w-1.5 h-8 ${bgClass} ${shadowClass} rotate-45 rounded-full`} />
            
            {/* Esquina inferior izquierda */}
            <div className={`absolute bottom-3 left-3 w-1.5 h-8 ${bgClass} ${shadowClass} rotate-45 rounded-full`} />
            {/* Esquina inferior derecha */}
            <div className={`absolute bottom-3 right-3 w-1.5 h-8 ${bgClass} ${shadowClass} -rotate-45 rounded-full`} />
        </div>
    );
};



