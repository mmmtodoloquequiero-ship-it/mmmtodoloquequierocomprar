import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Music, MessageCircle, AlertCircle, Heart, User } from 'lucide-react';

interface SocialInteraction {
  id: string;
  type: 'message' | 'song_request' | 'dedication' | 'gift' | 'media';
  sender_name: string;
  is_anonymous: boolean;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  expires_at?: string | null;
  view_once?: boolean;
  reactions?: Record<string, number>;
  comments?: { sender: string; text: string; timestamp: string }[];
}

  interface SocialWallProps {
  tenantId: string;
  primaryColor: string;
  isLight: boolean;
  hasPremiumVIP?: boolean;
  currentTable?: string | null;
  tables?: { id: string; name: string }[];
  onStartGiftMode?: (fromTable: string, toTable: string, isAnonymous: boolean, giftHint: string) => void;
}

export const SocialWall: React.FC<SocialWallProps> = ({ tenantId, primaryColor, isLight, hasPremiumVIP, currentTable, tables = [], onStartGiftMode }) => {
  const [messages, setMessages] = useState<SocialInteraction[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [customName, setCustomName] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [giftHint, setGiftHint] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [type, setType] = useState<'message' | 'song_request' | 'dedication' | 'gift' | 'media'>('message');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewedMessages, setViewedMessages] = useState<Set<string>>(new Set());
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // Media states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image_live'|'video_live'|'audio'|'meme' | null>(null);
  const [mediaDuration, setMediaDuration] = useState<'view_once'|'5'|'15'|'30'>('15');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filtrar la tabla actual
  const availableTables = tables.filter(t => t.name !== currentTable && t.id !== currentTable);


// ... keeping useEffect the same
  useEffect(() => {
    if (!tenantId) return;

    // Cargar mensajes aprobados (o recientes si no hay moderación estricta activada)
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('social_interactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Suscripción a nuevos mensajes aprobados
    const channel = supabase
      .channel(`public:social_interactions:tenant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_interactions',
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'approved') {
            setMessages(prev => [payload.new as SocialInteraction, ...prev].slice(0, 20));
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'approved') {
              setMessages(prev => {
                const exists = prev.find(m => m.id === payload.new.id);
                if (exists) return prev.map(m => m.id === payload.new.id ? payload.new as SocialInteraction : m);
                return [payload.new as SocialInteraction, ...prev].slice(0, 20);
              });
            } else if (payload.new.status === 'rejected') {
              setMessages(prev => prev.filter(m => m.id !== payload.new.id));
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedSenderName = isAnonymous
      ? 'Alguien Misterioso'
      : (customName.trim() ? `${currentTable} ${customName.trim()}` : (currentTable || 'Cliente'));

    if (type === 'gift') {
      if (!targetTable.trim()) {
        alert('Por favor indica a qué mesa quieres enviarle el regalo.');
        return;
      }
      if (onStartGiftMode) {
        onStartGiftMode(isAnonymous ? 'Anónimo' : resolvedSenderName, targetTable.trim(), isAnonymous, giftHint.trim());
      }
      return;
    }

    if (!newMessage.trim() && !selectedFile) return;

    setIsSubmitting(true);
    try {
      let mediaUrl = null;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || 'tmp';
        const fileName = `${tenantId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('social_media')
          .upload(fileName, selectedFile);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('social_media')
          .getPublicUrl(fileName);
          
        mediaUrl = publicUrl;
      }

      let expiresAt = null;
      if (mediaDuration !== 'view_once') {
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + parseInt(mediaDuration));
        expiresAt = expiryDate.toISOString();
      }

      const { error } = await supabase.from('social_interactions').insert([{
        tenant_id: tenantId,
        type: selectedFile ? 'media' : type,
        sender_name: resolvedSenderName,
        is_anonymous: isAnonymous,
        content: newMessage.trim(),
        status: 'pending', // Siempre pending, el Animador debe aprobarlo
        media_url: mediaUrl,
        media_type: mediaType,
        expires_at: expiresAt,
        view_once: mediaDuration === 'view_once'
      }]);

      if (error) throw error;

      alert('¡Enviado! Tu publicación está pendiente de moderación por el Animador.');
      setNewMessage('');
      setSelectedFile(null);
      setMediaType(null);
      if (!isAnonymous) setCustomName('');

    } catch (err) {
      console.error(err);
      alert('Hubo un error al enviar tu mensaje. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (interactionId: string, reactionType: string) => {
    // Optimistic UI update
    setMessages(prev => prev.map(m => {
      if (m.id === interactionId) {
        const currentReactions = m.reactions || { like: 0, haha: 0, love: 0, sad: 0 };
        return {
          ...m,
          reactions: {
            ...currentReactions,
            [reactionType]: (currentReactions[reactionType] || 0) + 1
          }
        };
      }
      return m;
    }));

    try {
      await supabase.rpc('increment_social_reaction', {
        p_interaction_id: interactionId,
        p_reaction_type: reactionType
      });
    } catch (e) {
      console.error('Error enviando reacción:', e);
    }
  };

  const handleAddComment = async (e: React.FormEvent, interactionId: string) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const resolvedSenderName = isAnonymous
      ? 'Alguien Misterioso'
      : (customName.trim() ? `${currentTable} ${customName.trim()}` : (currentTable || 'Cliente'));

    const newComment = { sender: resolvedSenderName, text: commentText.trim(), timestamp: new Date().toISOString() };

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id === interactionId) {
        return { ...m, comments: [...(m.comments || []), newComment] };
      }
      return m;
    }));

    setCommentingOn(null);
    setCommentText('');

    try {
      await supabase.rpc('add_social_comment', {
        p_interaction_id: interactionId,
        p_comment: newComment.text,
        p_sender: newComment.sender
      });
    } catch (e) {
      console.error('Error añadiendo comentario:', e);
    }
  };

  return (
    <div className={`rounded-3xl p-6 border transition-colors duration-500 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/50 border-slate-800'}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2" style={{ color: primaryColor }}>
          <Music className="w-5 h-5" />
          Muro Interactivo
        </h2>
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'}`}>
          Rockola & Dedicatorias
        </span>
      </div>

      <div className={`grid ${currentTable ? 'md:grid-cols-2' : 'md:grid-cols-2'} gap-6`}>
        {/* Formulario */}
        {currentTable ? (
        <div className="space-y-4">
          <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            ¡Pide un tema musical, envía una dedicatoria o invita un trago a otra mesa!
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2 p-1 bg-slate-900/20 rounded-xl overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => setType('message')}
                className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase rounded-lg transition-all ${type === 'message' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Mensaje
              </button>
              <button
                type="button"
                onClick={() => setType('song_request')}
                className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase rounded-lg transition-all ${type === 'song_request' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Rockola
              </button>
              <button
                type="button"
                onClick={() => setType('dedication')}
                className={`flex-1 min-w-[90px] py-2 text-xs font-bold uppercase rounded-lg transition-all ${type === 'dedication' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Dedicatoria
              </button>
              <button
                type="button"
                onClick={() => setType('gift')}
                className={`flex-1 min-w-[80px] py-2 text-[11px] font-black uppercase rounded-lg transition-all ${type === 'gift' ? 'bg-amber-500 text-white shadow-lg' : 'text-amber-500/70 hover:text-amber-400 bg-amber-500/10'}`}
              >
                🍻 Invitar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasPremiumVIP) {
                    alert('⚠️ El local no cuenta con el plan Premium VIP para habilitar la subida de contenido multimedia.');
                    return;
                  }
                  setType('media');
                }}
                className={`flex-1 min-w-[80px] py-2 text-xs font-bold uppercase rounded-lg transition-all flex justify-center items-center gap-1 ${type === 'media' ? 'bg-violet-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                VIP 📸
              </button>
            </div>

            {/* Hidden file input for media uploads */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept={
                mediaType === 'image_live' ? 'image/*' : 
                mediaType === 'video_live' ? 'video/*' : 
                mediaType === 'audio' ? 'audio/*' : 
                'image/*,image/gif'
              }
              capture={
                mediaType === 'image_live' ? 'environment' : 
                mediaType === 'video_live' ? 'environment' : 
                undefined
              }
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  // Limit video/audio size (approximate duration control since JS can't strictly block recording length natively before upload without MediaRecorder)
                  // 15MB limit to discourage long videos
                  if (file.size > 15 * 1024 * 1024) {
                    alert('El archivo es muy pesado. Intenta grabar menos de 30 segundos.');
                    return;
                  }
                  setSelectedFile(file);
                }
              }}
            />

            {!isAnonymous && (
              <div 
                className={`flex items-center rounded-xl border focus-within:ring-2 focus-within:ring-opacity-50 transition-all overflow-hidden ${isLight ? 'bg-slate-50 border-slate-200 focus-within:ring-slate-400' : 'bg-slate-900 border-slate-800 focus-within:ring-slate-700'}`}
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              >
                <div className={`px-4 py-3 text-sm font-bold border-r select-none flex items-center gap-1.5 whitespace-nowrap ${isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {currentTable}
                </div>
                <input
                  type="text"
                  placeholder="Tu nombre (opcional)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={20}
                  className={`w-full bg-transparent px-4 py-3 outline-none text-sm ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-500'}`}
                />
              </div>
            )}

            {type === 'gift' ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95">
                <select
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className={`w-full rounded-xl px-4 py-3 outline-none text-sm border focus:ring-2 focus:ring-opacity-50 transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                  required
                >
                  <option value="" disabled>Selecciona la mesa a invitar...</option>
                  {availableTables.length > 0 ? (
                    availableTables.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))
                  ) : (
                    <option value="" disabled>No hay otras mesas disponibles</option>
                  )}
                </select>
                <input
                  type="text"
                  placeholder="Mensaje o pista (ej: 'Para la de rojo', 'A la de azul')"
                  value={giftHint}
                  onChange={(e) => setGiftHint(e.target.value)}
                  maxLength={50}
                  className={`w-full rounded-xl px-4 py-3 outline-none text-sm border focus:ring-2 focus:ring-opacity-50 transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Serás redirigido al menú para elegir qué quieres enviarle a esa mesa. El ticket le llegará al mozo con la indicación.
                </p>
              </div>
            ) : type === 'media' ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setMediaType('image_live'); fileInputRef.current?.click(); }} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${mediaType === 'image_live' ? 'border-violet-500 bg-violet-500/10' : isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-800 bg-slate-900 hover:bg-slate-800'}`}>
                    <span className="text-2xl">📸</span>
                    <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Foto en Vivo</span>
                  </button>
                  <button type="button" onClick={() => { setMediaType('video_live'); fileInputRef.current?.click(); }} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${mediaType === 'video_live' ? 'border-violet-500 bg-violet-500/10' : isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-800 bg-slate-900 hover:bg-slate-800'}`}>
                    <span className="text-2xl">🎥</span>
                    <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Video (30s)</span>
                  </button>
                  <button type="button" onClick={() => { setMediaType('audio'); fileInputRef.current?.click(); }} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${mediaType === 'audio' ? 'border-violet-500 bg-violet-500/10' : isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-800 bg-slate-900 hover:bg-slate-800'}`}>
                    <span className="text-2xl">🎙️</span>
                    <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Grabar Audio</span>
                  </button>
                  <button type="button" onClick={() => { setMediaType('meme'); fileInputRef.current?.click(); }} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${mediaType === 'meme' ? 'border-violet-500 bg-violet-500/10' : isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-800 bg-slate-900 hover:bg-slate-800'}`}>
                    <span className="text-2xl">🤡</span>
                    <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Meme / GIF</span>
                  </button>
                </div>

                {selectedFile && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${isLight ? 'bg-violet-50 border-violet-100' : 'bg-violet-950/30 border-violet-900/50'}`}>
                    <span className={`text-xs font-bold truncate pr-4 ${isLight ? 'text-violet-700' : 'text-violet-300'}`}>
                      {selectedFile.name}
                    </span>
                    <button type="button" onClick={() => { setSelectedFile(null); setMediaType(null); fileInputRef.current && (fileInputRef.current.value = ''); }} className="text-red-500 text-xs font-bold uppercase">X</button>
                  </div>
                )}

                <div className={`p-4 rounded-xl border space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                  <label className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Duración de la publicación
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" onClick={() => setMediaDuration('view_once')} className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${mediaDuration === 'view_once' ? 'bg-red-500 border-red-500 text-white' : isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      💣 1 Vez
                    </button>
                    <button type="button" onClick={() => setMediaDuration('5')} className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${mediaDuration === '5' ? 'bg-slate-700 border-slate-700 text-white' : isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      5 min
                    </button>
                    <button type="button" onClick={() => setMediaDuration('15')} className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${mediaDuration === '15' ? 'bg-slate-700 border-slate-700 text-white' : isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      15 min
                    </button>
                    <button type="button" onClick={() => setMediaDuration('30')} className={`py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${mediaDuration === '30' ? 'bg-slate-700 border-slate-700 text-white' : isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      30 min
                    </button>
                  </div>
                </div>

                <textarea
                  placeholder="Escribe un mensaje para acompañar... (opcional)"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  maxLength={100}
                  rows={2}
                  className={`w-full rounded-xl px-4 py-3 outline-none text-sm border focus:ring-2 focus:ring-opacity-50 transition-all resize-none ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/50 border-slate-800 text-white'}`}
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                />
              </div>
            ) : (
              <textarea
                placeholder={
                  type === 'song_request' ? 'Ej: Soda Stereo - De música ligera' :
                  type === 'dedication' ? 'Ej: Para la mesa 4, ¡feliz cumpleaños!' :
                  'Escribe tu mensaje...'
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                maxLength={200}
                rows={3}
                className={`w-full rounded-xl px-4 py-3 outline-none text-sm border focus:ring-2 focus:ring-opacity-50 transition-all resize-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'}`}
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                required
              />
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-10 h-5 rounded-full relative transition-colors ${isAnonymous ? 'bg-purple-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAnonymous ? 'left-6' : 'left-1'}`} />
                </div>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="hidden"
                />
                <span className={`text-xs font-bold uppercase transition-colors ${isAnonymous ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                  Modo Misterioso 🕶️
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || (type === 'message' && !newMessage.trim()) || (type === 'gift' && !targetTable.trim()) || (type === 'media' && !selectedFile)}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {isSubmitting ? <span className="animate-pulse">Cargando...</span> : type === 'gift' ? <>Elegir Regalo <Send className="w-3 h-3" /></> : <>Enviar <Send className="w-3 h-3" /></>}
              </button>
            </div>
          </form>
        </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center border-r-0 md:border-r border-dashed border-slate-200/20">
             <Music className={`w-12 h-12 mb-4 opacity-50 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
             <p className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
               Escanea el QR de tu mesa para poder pedir canciones y enviar dedicatorias en vivo.
             </p>
          </div>
        )}

        {/* Feed del Muro */}
        <div className={`rounded-2xl p-4 overflow-y-auto max-h-[300px] border ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-slate-800/50'}`}>
          <h3 className="text-xs font-black uppercase text-slate-500 mb-4 sticky top-0 bg-inherit py-1 z-10 flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5" /> En Pantalla
          </h3>
          
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Sé el primero en publicar algo en el muro.
              </div>
            ) : (
              messages.map((msg) => {
                // Filtrar expirados localmente por seguridad visual
                if (msg.expires_at && new Date(msg.expires_at) < new Date()) return null;
                // Filtrar los view_once ya vistos
                if (msg.view_once && viewedMessages.has(msg.id)) return null;

                const isMedia = msg.type === 'media';

                return (
                  <div 
                    key={msg.id} 
                    className={`p-3 rounded-xl animate-in fade-in slide-in-from-bottom-2 ${
                      msg.type === 'song_request' ? 'bg-blue-500/10 border border-blue-500/20' :
                      msg.type === 'dedication' ? 'bg-pink-500/10 border border-pink-500/20' :
                      isMedia ? 'bg-violet-500/10 border border-violet-500/20' :
                      'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {msg.is_anonymous ? (
                        <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-purple-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-white uppercase">{msg.sender_name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-300">
                        {msg.sender_name}
                      </span>
                      <span className="text-[9px] text-slate-500 ml-auto">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.view_once ? (
                      <div className="my-2 p-4 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl animate-bounce">💣</span>
                        <button 
                          onClick={() => setViewedMessages(prev => new Set(prev).add(msg.id))}
                          className="px-4 py-2 bg-red-500 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                        >
                          Ver Mensaje Oculto
                        </button>
                        <span className="text-[9px] text-slate-500 uppercase">Se autodestruirá al abrir</span>
                      </div>
                    ) : (
                      <>
                        {msg.media_url && (
                          <div className="my-2 rounded-lg overflow-hidden bg-black/20 relative">
                            {msg.media_type === 'audio' ? (
                              <audio controls src={msg.media_url} className="w-full h-10" />
                            ) : msg.media_type === 'video_live' ? (
                              <video controls src={msg.media_url} className="w-full max-h-48 object-cover rounded-lg" />
                            ) : (
                              <img src={msg.media_url} alt="Contenido multimedia" className="w-full max-h-48 object-cover rounded-lg" loading="lazy" />
                            )}
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-sm text-white/90 leading-relaxed">
                            {msg.content}
                          </p>
                        )}
                      </>
                    )}

                    {msg.type === 'song_request' && (
                      <div className="mt-2 text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1">
                        <Music className="w-3 h-3" /> Petición Musical
                      </div>
                    )}
                    {msg.type === 'dedication' && (
                      <div className="mt-2 text-[10px] font-bold text-pink-400 uppercase flex items-center gap-1">
                        <Heart className="w-3 h-3" /> Dedicatoria Especial
                      </div>
                    )}
                    {isMedia && (
                      <div className="mt-2 text-[10px] font-bold text-violet-400 uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" /> Contenido VIP
                      </div>
                    )}
                    
                    {/* Reactions Bar */}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-500/20">
                      <button onClick={() => handleReaction(msg.id, 'like')} className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform">
                        <span className="text-sm">👍</span>
                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg.reactions?.like || 0}</span>
                      </button>
                      <button onClick={() => handleReaction(msg.id, 'love')} className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform">
                        <span className="text-sm">❤️</span>
                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg.reactions?.love || 0}</span>
                      </button>
                      <button onClick={() => handleReaction(msg.id, 'haha')} className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform">
                        <span className="text-sm">😂</span>
                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg.reactions?.haha || 0}</span>
                      </button>
                      <button onClick={() => handleReaction(msg.id, 'sad')} className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform">
                        <span className="text-sm">😢</span>
                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg.reactions?.sad || 0}</span>
                      </button>
                      <button onClick={() => handleReaction(msg.id, 'angry')} className="flex items-center gap-1 hover:scale-110 active:scale-95 transition-transform">
                        <span className="text-sm">😡</span>
                        <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{msg.reactions?.angry || 0}</span>
                      </button>
                      
                      <div className="ml-auto">
                        <button onClick={() => setCommentingOn(commentingOn === msg.id ? null : msg.id)} className={`text-[10px] font-bold uppercase hover:underline transition-all ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {msg.comments && msg.comments?.length > 0 ? `${msg.comments.length} Comentarios` : 'Comentar'}
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    {msg.comments && msg.comments.length > 0 && (
                      <div className="mt-3 space-y-2 pl-2 border-l-2 border-slate-500/20">
                        {msg.comments.map((comment, idx) => (
                          <div key={idx} className="text-xs">
                            <span className={`font-bold mr-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{comment.sender}:</span>
                            <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{comment.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment Form */}
                    {commentingOn === msg.id && (
                      <form onSubmit={(e) => handleAddComment(e, msg.id)} className="mt-3 flex gap-2 animate-in fade-in slide-in-from-top-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Escribe un comentario..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          maxLength={100}
                          className={`flex-1 rounded-lg px-3 py-1.5 outline-none text-xs border focus:ring-1 transition-all ${isLight ? 'bg-white border-slate-200 text-slate-900 focus:ring-slate-400' : 'bg-slate-900 border-slate-700 text-white focus:ring-slate-500'}`}
                        />
                        <button type="submit" disabled={!commentText.trim()} className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold uppercase rounded-lg disabled:opacity-50 transition-colors">
                          Enviar
                        </button>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
