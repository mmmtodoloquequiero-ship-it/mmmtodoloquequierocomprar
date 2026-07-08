import React from 'react';

export const GlobalWatermark = () => {
  return (
    <div className="w-full py-8 flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
      <a 
        href="https://www.mmmtodoloquequiero.com.ar" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-2"
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest drop-shadow-md">Powered by</span>
        <img 
          src="/logo.png" 
          alt="Mmm TodoLoQueQuiero Logo" 
          className="w-16 h-16 object-cover rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:scale-105 transition-all duration-300" 
        />
        <span className="text-xs font-black text-white tracking-widest uppercase mt-1 drop-shadow-md">
          Mmm<span className="text-amber-500">TodoLoQueQuiero</span>
        </span>
      </a>
    </div>
  );
};
