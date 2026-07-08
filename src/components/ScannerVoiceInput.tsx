'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Search, Camera, X } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface ScannerVoiceInputProps {
    onSearch: (term: string) => void;
    placeholder?: string;
}

export function ScannerVoiceInput({ onSearch, placeholder = "Buscar producto..." }: ScannerVoiceInputProps) {
    const [searchTerm, setSearchTerm] = useState('');
    
    // Voice State
    const [isListening, setIsListening] = useState(false);
    
    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Búsqueda Manual (teclado físico que escribe rápido)
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        onSearch(term);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchTerm);
    };

    // Voice Recognition Logic
    const toggleVoice = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome.');
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
            setSearchTerm('Escuchando...');
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                setSearchTerm(finalTranscript.trim());
                onSearch(finalTranscript.trim());
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech') {
                console.error("Voice recognition error:", event.error);
                setSearchTerm('');
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // Escáner de Cámara
    useEffect(() => {
        if (showScanner) {
            scannerRef.current = new Html5QrcodeScanner(
                "reader",
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                },
                false
            );

            scannerRef.current.render(
                (decodedText) => {
                    // Success callback
                    setSearchTerm(decodedText);
                    onSearch(decodedText);
                    setShowScanner(false);
                },
                (error) => {
                    // Ignore errors during scanning (happens every frame)
                }
            );
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, [showScanner]);

    return (
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-4 shadow-xl">
            <form id="search-form" onSubmit={handleSearchSubmit} className="flex gap-2 relative w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder={placeholder} 
                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-2xl pl-12 pr-4 py-4 font-bold text-base md:text-lg outline-none focus:border-amber-500 transition-all shadow-inner"
                    />
                    {searchTerm && !isListening && (
                        <button 
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                onSearch('');
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                
                <button 
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-5 rounded-2xl flex items-center justify-center shadow-lg transition-all"
                    title="Escanear Código"
                >
                    <Camera size={24} />
                </button>

                <button 
                    type="button"
                    onClick={toggleVoice}
                    className={`${isListening ? 'bg-red-600 animate-pulse' : 'bg-amber-600 hover:bg-amber-500'} text-white px-5 rounded-2xl flex items-center justify-center shadow-lg transition-all`}
                    title="Buscar por Voz"
                >
                    {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
            </form>

            {/* Modal de Cámara */}
            {showScanner && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-4 rounded-3xl relative shadow-2xl">
                        <button 
                            onClick={() => setShowScanner(false)} 
                            className="absolute -top-4 -right-4 bg-red-500 text-white p-2 rounded-full shadow-xl hover:bg-red-600 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <h3 className="text-white font-black text-center mb-4 uppercase tracking-wider text-sm">Escanea el Código</h3>
                        {/* Contenedor para Html5QrcodeScanner */}
                        <div id="reader" className="w-full rounded-2xl overflow-hidden bg-black text-white"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
