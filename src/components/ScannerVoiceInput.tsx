'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Search, Camera, X, Loader2 } from 'lucide-react';

interface ScannerVoiceInputProps {
    onSearch: (term: string) => void;
    placeholder?: string;
    /** Se llama SOLO cuando el código viene del escáner de cámara (no de voz/teclado) */
    onScanBarcode?: (barcode: string) => void;
    isLight?: boolean;
}

export function ScannerVoiceInput({ onSearch, placeholder = "Buscar producto...", onScanBarcode, isLight = false }: ScannerVoiceInputProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Voice State
    const [isListening, setIsListening] = useState(false);

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [isLoadingScanner, setIsLoadingScanner] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const scannerActiveRef = useRef(false);

    // --- Limpiar recursos de cámara ---
    const stopCamera = useCallback(() => {
        scannerActiveRef.current = false;
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const handleCloseScanner = useCallback(() => {
        stopCamera();
        setShowScanner(false);
        setScannerError(null);
    }, [stopCamera]);

    // --- Función de escaneo con BarcodeDetector (nativo) o ZXing (fallback) ---
    const startScanner = useCallback(async () => {
        setScannerError(null);
        setIsLoadingScanner(true);
        scannerActiveRef.current = true;

        try {
            // 1. Solicitar cámara trasera — primero con constraint exacto,
            //    si falla (dispositivo con una sola cámara) se pide sin restricción exacta.
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { exact: 'environment' } }
                });
            } catch {
                // Fallback: el dispositivo no distingue cámaras (ej: desktop o 1 sola cámara)
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            }

            if (!scannerActiveRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;

            // 2. Asignar stream al video
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setIsLoadingScanner(false);

            // 3. Intentar con BarcodeDetector nativo (Chrome en Android lo soporta)
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({
                    formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
                });

                scanIntervalRef.current = setInterval(async () => {
                    if (!videoRef.current || !scannerActiveRef.current) return;
                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes.length > 0) {
                            const code = barcodes[0].rawValue;
                            handleScanSuccess(code);
                        }
                    } catch {
                        // Sigue intentando
                    }
                }, 300);

            } else {
                // 4. Fallback con ZXing (importación dinámica para no romper SSR)
                const { BrowserMultiFormatReader } = await import('@zxing/browser');
                const codeReader = new BrowserMultiFormatReader();

                if (!videoRef.current || !scannerActiveRef.current) return;

                codeReader.decodeFromStream(stream, videoRef.current, (result, err) => {
                    if (result && scannerActiveRef.current) {
                        handleScanSuccess(result.getText());
                    }
                });
            }

        } catch (err: any) {
            setIsLoadingScanner(false);
            if (err.name === 'NotAllowedError') {
                setScannerError('❌ Permiso de cámara denegado. Ve a la configuración de tu navegador y activa el permiso de cámara para este sitio.');
            } else if (err.name === 'NotFoundError') {
                setScannerError('❌ No se encontró ninguna cámara en el dispositivo.');
            } else {
                setScannerError(`❌ Error al iniciar la cámara: ${err.message}`);
            }
        }
    }, []); // eslint-disable-line

    const handleScanSuccess = (decodedText: string) => {
        if (!scannerActiveRef.current) return;
        // Vibrar en móvil para confirmar escaneo
        if (navigator.vibrate) navigator.vibrate(200);
        setSearchTerm(decodedText);
        // Si hay un manejador específico de escaneo por cámara, usarlo primero
        if (onScanBarcode) {
            onScanBarcode(decodedText);
        } else {
            onSearch(decodedText);
        }
        handleCloseScanner();
    };

    // Iniciar cámara cuando se muestra el modal
    useEffect(() => {
        if (showScanner) {
            // Esperar un tick para que el DOM del modal esté listo
            const timer = setTimeout(() => {
                startScanner();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            stopCamera();
        }
    }, [showScanner, startScanner, stopCamera]);

    // Limpiar al desmontar
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    // --- Búsqueda Manual ---
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        onSearch(term);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchTerm);
    };

    // --- Reconocimiento de Voz ---
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

    return (
        <div className={`${isLight ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-slate-900/50 border-white/5 shadow-xl'} backdrop-blur-md border rounded-3xl p-4 transition-colors`}>
            <form id="search-form" onSubmit={handleSearchSubmit} className="flex gap-2 relative w-full">
                <div className="relative flex-1">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder={placeholder}
                        className={`w-full border rounded-2xl pl-12 pr-4 py-4 font-bold text-base md:text-lg outline-none focus:border-amber-500 transition-all shadow-inner ${
                            isLight 
                                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400' 
                                : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500'
                        }`}
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
                    className={`${isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'} border px-5 rounded-2xl flex items-center justify-center shadow-lg transition-all`}
                    title="Escanear Código de Barras"
                >
                    <Camera size={24} className={isLight ? "text-slate-500" : ""} />
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

            {/* Modal de Escáner de Cámara */}
            {showScanner && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <h3 className="text-white font-black uppercase tracking-wider text-sm">
                                📷 Escanear Código de Barras
                            </h3>
                            <button
                                onClick={handleCloseScanner}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Área de video */}
                        <div className="relative bg-black mx-4 mb-4 rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                autoPlay
                            />

                            {/* Overlay de guía de escaneo */}
                            {!isLoadingScanner && !scannerError && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="relative w-56 h-32">
                                        {/* Esquinas del visor */}
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                                        {/* Línea de escaneo animada */}
                                        <div className="absolute left-2 right-2 h-0.5 bg-amber-400/80 shadow-[0_0_8px_#f59e0b] animate-scan-line" />
                                    </div>
                                </div>
                            )}

                            {/* Loading */}
                            {isLoadingScanner && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                                    <Loader2 className="text-amber-400 animate-spin mb-3" size={40} />
                                    <p className="text-slate-300 text-sm font-semibold">Iniciando cámara...</p>
                                </div>
                            )}

                            {/* Error */}
                            {scannerError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4">
                                    <p className="text-red-400 text-sm text-center leading-relaxed">{scannerError}</p>
                                    <button
                                        onClick={startScanner}
                                        className="mt-4 bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Instrucción */}
                        {!scannerError && (
                            <p className="text-slate-400 text-xs text-center pb-5 px-4">
                                Apunta el código de barras al recuadro dorado
                            </p>
                        )}
                    </div>
                </div>
            )}


        </div>
    );
}
