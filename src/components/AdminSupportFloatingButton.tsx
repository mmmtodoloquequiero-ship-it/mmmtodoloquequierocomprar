import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

export const AdminSupportFloatingButton = ({ tenantId }: { tenantId: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) return;
        
        setIsSending(true);
        const { error } = await supabase.from('saas_support_tickets').insert([
            { tenant_id: tenantId, subject, message, status: 'open' }
        ]);

        if (error) {
            alert('Error al enviar mensaje: ' + error.message);
        } else {
            alert('¡Mensaje enviado al soporte técnico!');
            setIsOpen(false);
            setSubject('');
            setMessage('');
        }
        setIsSending(false);
    };

    return (
        <>
            {/* Botón flotante */}
            <button 
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 w-14 h-14 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:scale-110 transition-all z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                title="Soporte Técnico"
            >
                <MessageCircle size={24} />
            </button>

            {/* Panel de Soporte */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[340px] glass border border-white/10 rounded-3xl shadow-2xl z-50 animate-in slide-in-from-bottom-8 overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <MessageCircle size={20} />
                            <h3 className="font-black text-sm uppercase tracking-widest">Soporte Técnico</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white bg-white/10 p-1 rounded-full">
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Envíanos tu consulta y te responderemos a la brevedad.</p>
                        
                        <div>
                            <input 
                                type="text" 
                                required
                                placeholder="Asunto (Ej: Duda con facturación)"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <textarea 
                                required
                                rows={4}
                                placeholder="Describe tu problema o consulta..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 resize-none"
                            ></textarea>
                        </div>

                        <button 
                            type="submit"
                            disabled={isSending}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Enviar Mensaje
                        </button>

                        <div className="pt-2 border-t border-white/10 text-center">
                            <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
                                O contáctanos por WhatsApp
                            </a>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};
