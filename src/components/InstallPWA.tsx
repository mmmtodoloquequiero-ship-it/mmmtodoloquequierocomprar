"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Detect if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      return; // Already installed
    }

    if (isIosDevice) {
      // Show iOS instructions after 2 seconds
      setTimeout(() => setShowBanner(true), 2000);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="max-w-md mx-auto bg-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-[0_0_40px_rgba(249,115,22,0.2)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-slate-900 p-2 rounded-xl">
            <Download size={24} />
          </div>
          <div>
            <h4 className="font-black text-white text-sm">Instalar Aplicación</h4>
            <p className="text-[10px] text-slate-400">Acceso rápido y sin consumir espacio.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {isIOS ? (
            <button 
              onClick={() => alert("Para instalar en iPhone/iPad:\n1. Toca el botón 'Compartir' en Safari (cuadrado con flecha arriba)\n2. Selecciona 'Agregar a Inicio' (Add to Home Screen)")}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
            >
              Instrucciones
            </button>
          ) : (
            <button 
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs"
            >
              Instalar
            </button>
          )}
          <button 
            onClick={() => setShowBanner(false)}
            className="text-slate-500 hover:text-white p-2 rounded-full"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
