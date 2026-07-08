'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, Product, OrderItem, Ingredient, ProductIngredient, ProductOffer } from '@/types/database';
import { ShoppingBag, ChevronRight, ChevronLeft, Minus, Plus, X, Search, Utensils, CheckCircle, Loader2, Trash2, ChevronDown, ChevronUp, Star, BellRing, Instagram, Facebook, MessageCircle, MapPin, Map, Sun, Moon, Info, Gift, Home, ArrowLeft, Image as ImageIcon, Clock } from 'lucide-react';
import { MaxesLogo } from '@/components/MaxesLogo';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { SocialWall } from '@/components/SocialWall';
import { FiadoOnboarding } from './FiadoOnboarding';
import { GlobalWatermark } from '@/components/GlobalWatermark';

const AutoCarousel = ({ children, gapClass = 'gap-4 md:gap-6' }: { children: React.ReactNode, gapClass?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollRef.current.scrollBy({ left: clientWidth * 0.8, behavior: 'smooth' });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group">
      <button onClick={() => scroll('left')} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block backdrop-blur-md">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div ref={scrollRef} className={`flex overflow-x-auto ${gapClass} pb-6 snap-x snap-mandatory hide-scrollbar`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {children}
      </div>
      <button onClick={() => scroll('right')} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:block backdrop-blur-md">
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};

interface PublicMenuProps {
  tenant: any;
}

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  notes?: string;
}

const getProductIdsArray = (pIds: any): string[] => {
  if (!pIds) return [];
  if (Array.isArray(pIds)) return pIds;
  
  const strVal = String(pIds).trim();
  if (strVal.startsWith('{') && strVal.endsWith('}')) {
    return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
  }
  if (strVal.startsWith('[') && strVal.endsWith(']')) {
    try {
      return JSON.parse(strVal);
    } catch (e) {
      return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
    }
  }
  return [strVal];
};

const getMapIframeSrc = (iframeString: string): string => {
  if (!iframeString) return '';
  if (iframeString.includes('<iframe')) {
    const srcMatch = iframeString.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1];
    }
  }
  return iframeString;
};

// Formateador robusto de número de WhatsApp para evitar errores de "número inexistente"
const formatWhatsAppNumber = (phoneStr: string): string => {
  let clean = String(phoneStr || '').replace(/\D/g, '');
  if (!clean) return '';
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  // Si tiene 10 dígitos (ej: 1123456789), asumimos Argentina y agregamos prefijo internacional móvil 549
  if (clean.length === 10) {
    return '549' + clean;
  }
  
  // Si tiene 11 dígitos y empieza con 9 (ej: 9112345678), agregamos el prefijo de país 54
  if (clean.length === 11 && clean.startsWith('9')) {
    return '54' + clean;
  }
  
  // Si no empieza con ningún prefijo de la región, agregamos por defecto 549
  if (!clean.startsWith('54') && !clean.startsWith('56') && !clean.startsWith('55') && !clean.startsWith('598')) {
    return '549' + clean;
  }
  
  return clean;
};

export default function PublicMenu({ tenant }: PublicMenuProps) {
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme) {
      setIsLight(savedTheme === 'light');
    } else {
      setIsLight(tenant?.theme_colors?.mode === 'light');
    }
  }, [tenant?.theme_colors?.mode]);

  const toggleTheme = () => {
    const nextTheme = !isLight;
    setIsLight(nextTheme);
    localStorage.setItem('theme-mode', nextTheme ? 'light' : 'dark');
  };

  const { 
    categories, 
    products, 
    ingredients, 
    productIngredients,
    orders = [],
    productOffers = [],
    isLoading
  } = useRealtimeData(tenant.id, true);

  const notifyChanges = () => {
    broadcastTenantChange(tenant?.id);
  };

  const loading = isLoading;

  // Helper para obtener oferta activa de un producto hoy
  const getActiveOfferForProduct = (productId: string) => {
    return (productOffers || []).find(offer => {
      const pIds = getProductIdsArray(offer.product_ids);
      if (!pIds.includes(productId)) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parseDate = (dStr: string) => {
        const [y, m, d] = dStr.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d);
      };

      const start = parseDate(offer.start_date);
      const end = parseDate(offer.end_date);
      end.setHours(23, 59, 59, 999);

      const isDateValid = today >= start && today <= end;
      if (!isDateValid) return false;

      // Validar si la oferta tiene límite físico y si ya se ha consumido por completo
      if (offer.limit_quantity !== null && offer.limit_quantity !== undefined && offer.limit_quantity > 0) {
        let totalSold = 0;
        (orders || []).forEach(order => {
          if (order.is_archived) return;
          
          const orderDate = new Date(order.created_at);
          const isOrderInOfferRange = orderDate >= start && orderDate <= end;
          
          if (isOrderInOfferRange && order.items) {
            order.items.forEach(item => {
              if (item.product_id === productId) {
                totalSold += item.quantity;
              }
            });
          }
        });

        if (totalSold >= offer.limit_quantity) {
          return false; // Límite promocional alcanzado
        }
      }

      return true;
    });
  };
  
  // States para interactividad
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [showLanding, setShowLanding] = useState<boolean>(tenant.landing_config?.enabled || false);
  const [giftMode, setGiftMode] = useState<{ isActive: boolean, fromTable: string, toTable: string, isAnonymous: boolean, giftHint: string }>({ isActive: false, fromTable: '', toTable: '', isAnonymous: false, giftHint: '' });
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const toggleProductDesc = (id: string) => {
    setExpandedProducts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // States para Reseñas
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // States para Reservas y Seña
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [reservationName, setReservationName] = useState('');
  const [reservationPhone, setReservationPhone] = useState('');
  const [reservationPhonePrefix, setReservationPhonePrefix] = useState('+54');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationPartySize, setReservationPartySize] = useState<number>(2);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
  const [bookedTimesCount, setBookedTimesCount] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!reservationDate || !tenant?.id) return;
    
    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('reservation_time')
        .eq('tenant_id', tenant.id)
        .eq('reservation_date', reservationDate)
        .in('status', ['confirmed', 'pending_payment']);
        
      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach((r) => {
          if (r.reservation_time) {
              const timePrefix = r.reservation_time.substring(0, 5);
              counts[timePrefix] = (counts[timePrefix] || 0) + 1;
          }
        });
        setBookedTimesCount(counts);
      }
    };
    fetchBookings();
  }, [reservationDate, tenant?.id]);

  // Horarios de reserva disponibles (calculados)
  const availableReservationTimes = useMemo(() => {
    if (!reservationDate) return [];
    
    const selectedDate = new Date(reservationDate + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay().toString();
    const resHours = (tenant as any).reservation_hours;
    
    const now = new Date();
    const isToday = selectedDate.getDate() === now.getDate() && 
                    selectedDate.getMonth() === now.getMonth() && 
                    selectedDate.getFullYear() === now.getFullYear();
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();

    let timeSlots = [];
    if (resHours && resHours.enabled && resHours.schedule && resHours.schedule[dayOfWeek]) {
        timeSlots = resHours.schedule[dayOfWeek];
    } else {
        // Fallback: Si no hay horarios configurados o está apagado el candado estricto, 
        // permitimos 24hs (y validaremos si el horario pasó si es hoy).
        timeSlots = [{ open: '00:00', close: '23:59' }];
    }
    
    if (timeSlots.length === 0) return [];

    const availableSlots: string[] = [];
    for (const slot of timeSlots) {
        if (!slot.open || !slot.close) continue;
        const [oH, oM] = slot.open.split(':').map(Number);
        const [cH, cM] = slot.close.split(':').map(Number);
        const openMins = oH * 60 + oM;
        let closeMins = cH * 60 + cM;
        if (closeMins < openMins) closeMins += 24 * 60; 
        
        for (let t = openMins; t <= closeMins; t += 30) {
           let adjustedT = t;
           if (adjustedT >= 24 * 60) adjustedT -= 24 * 60;
           
           if (isToday) {
               if (t < 24 * 60 && adjustedT <= currentTotalMins) continue;
           }
           
           const h = Math.floor(adjustedT / 60);
           const m = adjustedT % 60;
           availableSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    
    const uniqueSlots = Array.from(new Set(availableSlots));
    
    // Filtrar turnos llenos (donde reservas >= cantidad de mesas)
    const totalTables = Array.isArray(tenant?.tables) ? tenant.tables.length : 0;
    const occupiedTables = (isToday && Array.isArray(tenant?.tables)) ? tenant.tables.filter((t: any) => t.is_occupied).length : 0;
    const availableTablesCount = Math.max(0, totalTables - occupiedTables);
    
    const capacityFilteredSlots = uniqueSlots.filter(time => {
        const booked = bookedTimesCount[time] || 0;
        return booked < availableTablesCount;
    });

    return capacityFilteredSlots.sort((a, b) => {
        const amins = parseInt(a.split(':')[0]) * 60 + parseInt(a.split(':')[1]);
        const bmins = parseInt(b.split(':')[0]) * 60 + parseInt(b.split(':')[1]);
        return amins - bmins;
    });
  }, [reservationDate, tenant, bookedTimesCount]);

  useEffect(() => {
      // Auto-seleccionar el primer horario disponible si el actual no es válido
      if (availableReservationTimes.length > 0 && !availableReservationTimes.includes(reservationTime)) {
          setReservationTime(availableReservationTimes[0]);
      } else if (availableReservationTimes.length === 0) {
          setReservationTime('');
      }
  }, [availableReservationTimes, reservationTime]);
  
  // Pasarela virtual Mercado Pago para Reservas
  const [isMpReservationModalOpen, setIsMpReservationModalOpen] = useState(false);
  const [isMpReservationPaying, setIsMpReservationPaying] = useState(false);
  const [isMpReservationSuccess, setIsMpReservationSuccess] = useState(false);
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);
  const [reservationToPayAmount, setReservationToPayAmount] = useState<number>(0);
  const [generatedReservationCode, setGeneratedReservationCode] = useState<string>('');

  // Validacion de Cupones de Seña en Carrito
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [validatedReservation, setValidatedReservation] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [showAntiForgetModal, setShowAntiForgetModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // States del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  
  const [questionModalProduct, setQuestionModalProduct] = useState<Product | null>(null);
  const [questionModalAnswer, setQuestionModalAnswer] = useState('');
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [pendingWeightQty, setPendingWeightQty] = useState<number | null>(null);
  
  // Checkout states
  const [customerInfo, setCustomerInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<number | null>(null);
  
  // Propinas
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');

  // Navegación e Historial (Botón Atrás físico)
  const goToMenu = () => {
    setShowLanding(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.location.hash !== '#menu') {
      window.history.pushState({ screen: 'menu' }, '', window.location.pathname + window.location.search + '#menu');
    }
  };

  const goToLanding = () => {
    setShowLanding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.location.hash === '#menu') {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      // Si el carrito estaba abierto y el hash ya no es #cart, lo cerramos
      if (window.location.hash !== '#cart') {
        setIsCartOpen(false);
      }
      // Manejo del landing
      if (window.location.hash !== '#menu' && window.location.hash !== '#cart' && tenant?.landing_config?.enabled) {
        setShowLanding(true);
      } else if (window.location.hash === '#menu' || window.location.hash === '#cart') {
        setShowLanding(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [tenant?.landing_config?.enabled, setIsCartOpen]);

  // Sincronizar el estado del carrito con el History API para que el botón "Atrás" físico funcione bien
  useEffect(() => {
    if (isCartOpen) {
      if (window.location.hash !== '#cart') {
        window.history.pushState({ screen: 'cart' }, '', window.location.pathname + window.location.search + '#cart');
      }
    } else {
      // Si se cierra programáticamente (ej. por botón "x") y estábamos en #cart, sacamos el hash
      if (window.location.hash === '#cart') {
        window.history.back();
      }
    }
  }, [isCartOpen]);

  // Utilidad para evaluar si estamos dentro del horario operativo
  const checkIsCurrentlyOpen = (cfg: any) => {
    if (!cfg || !cfg.enabled || !cfg.schedule) return true; // Si no está habilitado, siempre está abierto
    
    const now = new Date();
    let currentDayStr = String(now.getDay()); // 0 (Dom) a 6 (Sab)
    
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    const todayShifts = cfg.schedule[currentDayStr] || [];
    
    if (todayShifts.length === 0) return false;

    for (const shift of todayShifts) {
      if (shift.open <= shift.close) {
        if (currentTimeStr >= shift.open && currentTimeStr <= shift.close) return true;
      } else {
        if (currentTimeStr >= shift.open || currentTimeStr <= shift.close) return true;
      }
    }
    
    let yesterdayDayStr = String((now.getDay() - 1 + 7) % 7);
    const yesterdayShifts = cfg.schedule[yesterdayDayStr] || [];
    for (const shift of yesterdayShifts) {
      if (shift.open > shift.close) {
        if (currentTimeStr <= shift.close) return true;
      }
    }

    return false;
  };

  const isBusinessOpen = checkIsCurrentlyOpen(tenant?.business_hours);
  const isDeliveryHoursOpen = checkIsCurrentlyOpen(tenant?.delivery_hours);
  const isDeliveryPanicActive = tenant?.delivery_panic_button === true;

  // Delivery and Payment State
  const currentDayOfWeek = new Date().getDay();
  const tenantDeliveryDays = tenant?.delivery_days || [0,1,2,3,4,5,6];
  const isDeliveryActiveToday = tenantDeliveryDays.includes(currentDayOfWeek) && !isDeliveryPanicActive && isDeliveryHoursOpen;


  const [deliveryType, setDeliveryType] = useState<'local' | 'llevar' | 'delivery'>('llevar'); // 'local' es salón (con mesa), 'llevar' (Take Away), 'delivery' (Envío)
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMapLink, setDeliveryMapLink] = useState('');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<{ name: string; fee: number } | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+54');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'mercadopago' | 'credito' | 'fiado'>('efectivo');
  const [fiadoCustomerId, setFiadoCustomerId] = useState<string | null>(null);

  // AFIP Billing States
  const [afipBillingRequested, setAfipBillingRequested] = useState(false);
  const [afipClientType, setAfipClientType] = useState<'consumidor_final' | 'monotributista' | 'responsable_inscripto'>('consumidor_final');
  const [afipDocType, setAfipDocType] = useState<'DNI' | 'CUIT'>('CUIT');
  const [afipDocNumber, setAfipDocNumber] = useState('');

  // Estados del Club de Clientes y Fidelización (Monedero Virtual mmmTodoLoQueQuiero 2026)
  const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
  const [useLoyaltyDiscount, setUseLoyaltyDiscount] = useState(false);

  useEffect(() => {
    const cleanPhone = deliveryPhone ? `${phonePrefix} ${deliveryPhone.trim()}`.trim() : '';
    if (!tenant?.id || !deliveryPhone.trim() || deliveryPhone.trim().length < 6) {
      setLoyaltyAccount(null);
      setUseLoyaltyDiscount(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('loyalty_accounts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('phone_number', cleanPhone)
          .single();

        if (!error && data) {
          setLoyaltyAccount(data);
        } else {
          setLoyaltyAccount(null);
        }
      } catch (e) {
        setLoyaltyAccount(null);
      }
    }, 600); // 600ms de debounce para no saturar la API al escribir

    return () => clearTimeout(timer);
  }, [deliveryPhone, phonePrefix, tenant?.id]);

  // Mercado Pago pasarela virtual


  // Table and waiter calling states
  const [tableParamId, setTableParamId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [waiterCallCooldown, setWaiterCallCooldown] = useState(0);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Estados y referencias para el botón flotante arrastrable (Premium Glassmorphic)
  const [dragPosition, setDragPosition] = useState({ x: 24, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const positionStart = React.useRef({ x: 0, y: 0 });
  const dragDistance = React.useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { ...dragPosition };
    dragDistance.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = dragStart.current.y - e.clientY; // Invertido porque bottom aumenta hacia arriba
    
    dragDistance.current = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let newX = positionStart.current.x + deltaX;
    let newY = positionStart.current.y + deltaY;

    // Mantener dentro del Viewport con un padding de resguardo
    const padding = 10;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 500;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    newX = Math.max(padding, Math.min(screenWidth - 170, newX));
    newY = Math.max(padding, Math.min(screenHeight - 80, newY));

    setDragPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dragDistance.current > 5) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleCallWaiter();
  };


  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tableId = params.get('table');
      if (tableId) {
        setTableParamId(tableId);
        setTableName(tableId);
        setDeliveryType('local');
        
        const tables = tenant?.tables || [];
        const match = tables.find((t: any) => {
            const tableIdLower = (t.id || '').toLowerCase().trim();
            const tableNameLower = (t.name || '').toLowerCase().trim();
            const searchStr = tableId.toLowerCase().trim();

            if (tableIdLower === searchStr || tableNameLower === searchStr) return true;

            const numMatchSearch = searchStr.match(/\d+/);
            if (numMatchSearch) {
                const num = numMatchSearch[0];
                
                const numMatchName = tableNameLower.match(/\d+/);
                if (numMatchName && numMatchName[0] === num) return true;

                const numMatchId = tableIdLower.match(/\d+/);
                if (numMatchId && numMatchId[0] === num) return true;
                
                if (tableIdLower.includes(num)) return true;
            }
            return false;
        });
        if (match) {
          setTableName(match.name);
        }

        // --- Lógica de Sesión de Mesa con QR (2 min) ---
        const isScan = params.get('scan') === 'true';
        const sessionKey = `table_session_${tenant.id}`;
        
        if (isScan) {
          localStorage.setItem(sessionKey, Date.now().toString());
          params.delete('scan');
          const queryString = params.toString();
          const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;
          window.history.replaceState({}, document.title, newUrl);
          setIsSessionExpired(false);
          
          // Marcar la mesa como ocupada globalmente
          if (tenant?.id && tableId) {
            fetch('/api/tables/occupy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenantId: tenant.id, tableId: tableId })
            }).catch(e => console.error("Error setting table occupancy:", e));
          }
        } else {
          const sessionStart = localStorage.getItem(sessionKey);
          if (sessionStart) {
            const elapsedTime = Date.now() - parseInt(sessionStart, 10);
            const SESSION_TIMEOUT_MS = 90 * 60 * 1000; // 90 minutos (1 hora y media)
            if (elapsedTime > SESSION_TIMEOUT_MS) {
              setIsSessionExpired(true);
            }
          } else {
            // Link copiado sin ser escaneado recientemente
            setIsSessionExpired(true);
          }
        }

        // Check en tiempo real cada minuto
        intervalId = setInterval(() => {
          const sessionStart = localStorage.getItem(sessionKey);
          if (sessionStart) {
            const elapsedTime = Date.now() - parseInt(sessionStart, 10);
            const SESSION_TIMEOUT_MS = 90 * 60 * 1000; // 90 min
            if (elapsedTime > SESSION_TIMEOUT_MS) {
              setIsSessionExpired(true);
            }
          }
        }, 60000);
      }

      // -----------------------------------------------------
      // DETECCIÓN DE RETORNO DE MERCADO PAGO
      // -----------------------------------------------------
      const mpStatus = params.get('collection_status');
      const orderIdRef = params.get('external_reference');
      const isReservation = params.get('reservation_id');
      
      if (mpStatus === 'approved') {
        // Limpiar URL para que no vuelva a procesar
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (isReservation) {
          // Es una reserva exitosa
          const code = generateResCode();
          setGeneratedReservationCode(code);
          
          fetch('/api/mercadopago/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenant?.id,
              collection_id: params.get('collection_id'),
              reservation_id: isReservation,
              generated_code: code
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
                setIsMpReservationSuccess(true);
                // Notificar al local
                supabase.from('app_notifications').insert([{
                  message: `✅ Seña Pagada para Reserva (Cód: ${code})`,
                  type: 'info',
                  target_roles: ['admin', 'staff'],
                  tenant_id: tenant?.id || ''
                }]).then();
            } else {
                alert("Lo sentimos, no pudimos verificar tu pago de seña con Mercado Pago.");
            }
          });
        } else if (orderIdRef) {
          // Verificar el pago de forma segura en el servidor
          fetch('/api/mercadopago/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenant?.id,
              collection_id: params.get('collection_id'),
              order_id: orderIdRef
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
                setOrderSuccess(true);
                setSuccessOrderNumber(0); // 0 indica pedido online
                
                // Notificar al local
                supabase.from('app_notifications').insert([{
                  message: `✅ Pago Online Aprobado para el pedido (Ref: ${orderIdRef.substring(0,6)})`,
                  type: 'info',
                  target_roles: ['admin', 'staff'],
                  tenant_id: tenant?.id || ''
                }]).then();

                setTimeout(() => {
                  setOrderSuccess(false);
                  setSuccessOrderNumber(null);
                  setIsCartOpen(false);
                }, 18000);
            } else {
                alert("Lo sentimos, no pudimos verificar tu pago con Mercado Pago.");
            }
          });
        }
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [tenant]);

  useEffect(() => {
    if (waiterCallCooldown > 0) {
      const timer = setTimeout(() => setWaiterCallCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [waiterCallCooldown]);

  // Carga y Realtime de Reseñas
  useEffect(() => {
    if (!tenant?.id) return;

    const fetchReviews = async () => {
      setIsReviewsLoading(true);
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReviews(data || []);
      } catch (err) {
        console.error('Error al cargar reseñas:', err);
      } finally {
        setIsReviewsLoading(false);
      }
    };

    fetchReviews();

    const channel = supabase
      .channel(`public:reviews:tenant:${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `tenant_id=eq.${tenant.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReviews(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReviews(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // Cálculo de promedio de calificaciones
  const { avgRating, totalReviews } = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avgRating: '5.0', totalReviews: 0 };
    }
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const avg = sum / reviews.length;
    return {
      avgRating: avg.toFixed(1),
      totalReviews: reviews.length
    };
  }, [reviews]);

  // Desestructuración segura del perfil del local y enlaces sociales
  const profilePictureUrl = tenant.profile_picture_url || '';
  const bannerUrl = tenant.banner_url || '';
  const reviewsEnabled = tenant.reviews_enabled !== false; // Habilitado por defecto
  const reservationsEnabled = tenant.reservations_enabled === true;
  const reservationDepositAmount = tenant.reservation_deposit_amount || 0;

  const socialLinks = useMemo(() => {
    const defaultLinks = { instagram: '', facebook: '', whatsapp: '', address: '', google_maps_url: '', maps_iframe: '' };
    if (!tenant.social_links) {
      return defaultLinks;
    }
    if (typeof tenant.social_links === 'string') {
      try {
        return { ...defaultLinks, ...JSON.parse(tenant.social_links) };
      } catch (e) {
        return defaultLinks;
      }
    }
    return { ...defaultLinks, ...tenant.social_links };
  }, [tenant.social_links]);

  // Límites de fecha para la reserva (mínimo hoy, máximo 1 mes en el futuro)
  const reservationDateLimits = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDateStr = `${yyyy}-${mm}-${dd}`;
    
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    const maxYYYY = maxDate.getFullYear();
    const maxMM = String(maxDate.getMonth() + 1).padStart(2, '0');
    const maxDD = String(maxDate.getDate()).padStart(2, '0');
    const maxDateStr = `${maxYYYY}-${maxMM}-${maxDD}`;
    
    return { min: minDateStr, max: maxDateStr };
  }, []);

  // Guardar nueva reseña en Supabase
  const handleSubmitReview = async () => {
    if (!newReviewName.trim()) {
      alert("⚠️ Por favor ingresa tu Nombre.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert([
          {
            tenant_id: tenant.id,
            client_name: newReviewName.trim(),
            rating: newReviewRating,
            comment: newReviewComment.trim()
          }
        ]);

      if (error) throw error;
      
      setIsReviewModalOpen(false);
      setNewReviewName('');
      setNewReviewRating(5);
      setNewReviewComment('');
      
      alert("🎉 ¡Muchas gracias por tu reseña! Tu opinión es muy valiosa para nosotros.");
    } catch (err) {
      console.error('Error al guardar la reseña:', err);
      alert("⚠️ Ocurrió un error al guardar tu reseña. Por favor intenta de nuevo.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // (El control automático de ocupación por QR fue eliminado a pedido del usuario)

  // 2. Mesas Libres ahora
  const [reservedTablesForToday, setReservedTablesForToday] = useState<number>(0);

  useEffect(() => {
    const fetchTodayReservations = async () => {
      if (!tenant?.id) return;
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('reservations')
          .select('assigned_tables')
          .eq('tenant_id', tenant.id)
          .eq('reservation_date', todayStr)
          .in('status', ['confirmed', 'pending_payment']);

        if (error) throw error;

        let reservedCount = 0;
        data?.forEach((res: any) => {
          if (res.assigned_tables && Array.isArray(res.assigned_tables)) {
            reservedCount += res.assigned_tables.length;
          }
        });
        setReservedTablesForToday(reservedCount);
      } catch (err: any) {
        if (err?.code !== '42P01' && err?.code !== 'PGRST116') {
          console.error('Error fetching today reservations:', err.message || err);
        }
      }
    };
    
    fetchTodayReservations();
    
    // Subscribe to changes in reservations for this tenant to keep count updated
    const channel = supabase.channel(`public_menu_reservations_${tenant?.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reservations',
        filter: `tenant_id=eq.${tenant?.id}`
      }, () => {
        fetchTodayReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const freeTablesCount = useMemo(() => {
    const tables = tenant?.tables || [];
    const physicallyFreeCount = tables.filter((t: any) => !t.is_occupied).length;
    // Restamos las mesas que están físicamente libres pero reservadas para hoy.
    // Usamos Math.max para que nunca sea negativo en caso de desajustes.
    return Math.max(0, physicallyFreeCount - reservedTablesForToday);
  }, [tenant?.tables, reservedTablesForToday]);

  // Generador de Código de Reserva (6 caracteres en mayúsculas)
  const generateResCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RES-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 3. Crear Reserva en Supabase
  const handleSubmitReservation = async () => {
    if (!reservationName.trim() || !reservationPhone.trim() || !reservationDate || !reservationTime) {
      alert("⚠️ Por favor completa todos los campos del formulario.");
      return;
    }

    // Validar rango de fecha (mínimo hoy, máximo 1 mes en el futuro)
    const selectedDate = new Date(reservationDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    maxDate.setHours(23, 59, 59, 999);

    if (selectedDate < today) {
      alert("⚠️ No puedes seleccionar una fecha en el pasado.");
      return;
    }

    if (selectedDate > maxDate) {
      alert("⚠️ Solo puedes reservar con un máximo de 1 mes de anticipación.");
      return;
    }

    // Validar hora pasada para hoy
    const selectedDateTime = new Date(`${reservationDate}T${reservationTime}:00`);
    const now = new Date();
    if (selectedDate.getTime() === today.getTime() && selectedDateTime <= now) {
      alert("⚠️ El horario seleccionado ya pasó. Por favor elige un horario posterior.");
      return;
    }

    // Validar contra reservation_hours
    const dayOfWeek = selectedDateTime.getDay().toString();
    const resHours = (tenant as any).reservation_hours;
    if (resHours && resHours.enabled && resHours.schedule && resHours.schedule[dayOfWeek]) {
      const timeSlots = resHours.schedule[dayOfWeek];
      
      if (timeSlots.length === 0) {
        alert("⚠️ Lo sentimos, el local no acepta reservas en el día seleccionado.");
        return;
      }

      let isValidTime = false;
      const [selHours, selMins] = reservationTime.split(':').map(Number);
      const selectedTotalMins = selHours * 60 + selMins;

      for (const slot of timeSlots) {
        if (!slot.open || !slot.close) continue;
        const [oH, oM] = slot.open.split(':').map(Number);
        const [cH, cM] = slot.close.split(':').map(Number);
        const openMins = oH * 60 + oM;
        const closeMins = cH * 60 + cM;

        if (closeMins < openMins) { // Cruza medianoche
          if (selectedTotalMins >= openMins || selectedTotalMins <= closeMins) {
            isValidTime = true;
            break;
          }
        } else {
          if (selectedTotalMins >= openMins && selectedTotalMins <= closeMins) {
            isValidTime = true;
            break;
          }
        }
      }

      if (!isValidTime) {
        alert("⚠️ El horario seleccionado no se encuentra dentro del turno de reservas habilitado para ese día.");
        return;
      }
    }

      // Determine the shift
      const getShift = (timeStr: string) => {
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (hour >= 11 && hour < 16) return 'mediodia';
        if (hour >= 16 && hour < 20) return 'tarde';
        return 'noche';
      };
      
      const shift = getShift(reservationTime);

      setIsSubmittingReservation(true);
      try {
      // 1. Fetch existing reservations for this day to check table availability
      const { data: existingReservations, error: fetchError } = await supabase
        .from('reservations')
        .select('assigned_tables, reservation_time')
        .eq('tenant_id', tenant.id)
        .eq('reservation_date', reservationDate)
        .in('status', ['pending_payment', 'confirmed']);

      if (fetchError) {
        setIsSubmittingReservation(false);
        alert("⚠️ Error al verificar la disponibilidad de mesas. Intenta de nuevo.");
        return;
      }

      // 2. Filter reservations that belong to the SAME SHIFT
      const assignedTableIds = new Set<string>();
      existingReservations.forEach(res => {
        if (getShift(res.reservation_time) === shift) {
          const tables = res.assigned_tables || [];
          tables.forEach((t: any) => assignedTableIds.add(t.id));
        }
      });

      // 3. Find available tables and auto-assign
      const allTables = tenant.tables || [];
      const availableTables = allTables.filter((t: any) => !assignedTableIds.has(t.id));
      
      // Sort ascending by capacity to try to use the smallest combinations first
      availableTables.sort((a: any, b: any) => (a.capacity || 2) - (b.capacity || 2));

      let remainingSize = reservationPartySize;
      const tablesToAssign: any[] = [];

      for (const table of availableTables) {
        if (remainingSize <= 0) break;
        tablesToAssign.push(table);
        remainingSize -= (table.capacity || 2);
      }

      if (remainingSize > 0) {
        setIsSubmittingReservation(false);
        alert(`⚠️ Lo sentimos, el local no tiene capacidad suficiente (${reservationPartySize} personas) en el turno ${shift.toUpperCase()} para esta fecha.`);
        return;
      }

      const depositPerTable = tenant.reservation_deposit_amount || 0;
      const depositAmount = depositPerTable * tablesToAssign.length;
      
      const status = depositAmount > 0 ? 'pending_payment' : 'confirmed';
      const code = status === 'confirmed' ? generateResCode() : '';
      const finalReservationPhone = reservationPhone ? `${reservationPhonePrefix} ${reservationPhone.trim()}` : '';

      const newReservation = {
        tenant_id: tenant.id,
        client_name: reservationName.trim(),
        client_phone: finalReservationPhone,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        party_size: reservationPartySize,
        status: status,
        deposit_amount: depositAmount,
        reservation_code: code || null,
        is_deposit_applied: false,
        assigned_tables: tablesToAssign,
        shift: shift,
        message_sent: false
      };

      const { data, error } = await supabase
        .from('reservations')
        .insert([newReservation])
        .select()
        .single();

      if (error) throw error;

      if (depositAmount > 0) {
        setIsReservationModalOpen(false);
        setPendingReservationId(data.id);
        setReservationToPayAmount(depositAmount);
        handleConfirmReservationPayment(data.id, depositAmount);
      } else {
        setIsReservationModalOpen(false);
        alert(`🎉 ¡Reserva Confirmada con éxito!\n\nSe te ha(n) asignado ${tablesToAssign.length} mesa(s) para el turno ${shift.toUpperCase()}.\n\nTu Código de Reserva es: ${code}\nTe esperamos.`);
      }
    } catch (err) {
      console.error('Error al registrar la reserva:', err);
      alert("⚠️ Ocurrió un error al registrar tu reserva. Por favor intenta de nuevo.");
    } finally {
      setIsSubmittingReservation(false);
    }
  };

  // 4. Pago de Seña de Reserva con Mercado Pago
  const handleConfirmReservationPayment = async (reservationId: string, depositAmount: number) => {
    if (!reservationId) return;
    setIsMpReservationPaying(true);

    if (!tenant?.mercadopago_access_token) {
      alert("⚠️ El local no tiene habilitados los pagos online.");
      setIsMpReservationPaying(false);
      return;
    }

    try {
      setIsRedirectingToPayment(true);
      let currentDomain = window.location.origin;
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
      if (currentDomain.startsWith('http://') && !isLocalhost) {
        currentDomain = currentDomain.replace('http://', 'https://');
      }

      if (!depositAmount && !tenant.reservation_deposit_amount) {
        throw new Error("No se pudo obtener el monto de la seña.");
      }

      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          external_reference: reservationId,
          items: [
            {
              title: `Seña de Reserva - ${tenant.name}`,
              unit_price: depositAmount || tenant.reservation_deposit_amount,
              quantity: 1,
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`,
            failure: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`,
            pending: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`
          }
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || "Error al generar pasarela de pago para la reserva");
      }
    } catch (err) {
      console.error('Error al iniciar pago de reserva:', err);
      alert("⚠️ Error al acreditar el pago. Por favor intenta de nuevo.");
      setIsMpReservationPaying(false);
      setIsRedirectingToPayment(false);
    }
  };

  // 5. Validar Cupón de Reserva en el Carrito (Caja y Anti-Fraude)
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('⚠️ Por favor ingresa un código.');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    
    try {
      let cleanCode = couponCode.replace(/\s+/g, '').toUpperCase();
      if (cleanCode.length === 4 && !cleanCode.startsWith('RES-')) {
        cleanCode = 'RES-' + cleanCode;
      }
      
      // 1. Buscar en reservas
      const { data: resData } = await supabase
        .from('reservations')
        .select('*')
        .eq('reservation_code', cleanCode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (resData) {
        if (resData.status !== 'confirmed') {
          setCouponError('❌ Esta reserva no se encuentra confirmada.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        if (resData.is_deposit_applied === true) {
          setCouponError('❌ Este código ya fue utilizado en otro pedido.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        // Reserva válida
        setCouponSuccess(`✅ ¡Reserva Válida! Seña de $${resData.deposit_amount} descontada.`);
        setAppliedDiscount(resData.deposit_amount || 0);
        setValidatedReservation({ type: 'reservation', data: resData });
        return;
      }

      // 2. Si no es reserva, buscar en discount_codes
      const { data: codeData } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (codeData) {
        if (codeData.is_used) {
          setCouponError('❌ Este código de descuento ya fue utilizado.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        // Código válido
        setCouponSuccess(`✅ ¡Código Válido! Descuento de $${codeData.discount_amount} aplicado.`);
        setAppliedDiscount(codeData.discount_amount || 0);
        setValidatedReservation({ type: 'discount_code', data: codeData });
        return;
      }

      // Si no encontró nada
      setCouponError('❌ Código inexistente o no válido para este local.');
      setAppliedDiscount(0);
      setValidatedReservation(null);

    } catch (err) {
      console.error('Error al validar código:', err);
      setCouponError('⚠️ Error de conexión al validar.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleCallWaiter = async () => {
    if (!tenant || !tableParamId || waiterCallCooldown > 0) return;
    setIsCallingWaiter(true);
    try {
      const displayTable = tableName || tableParamId;
      const { error } = await supabase.from('app_notifications').insert([{
        message: `🚨 ASISTENCIA MESA: ${displayTable} solicita ayuda.`,
        type: 'info',
        target_roles: ['waiter', 'admin'],
        tenant_id: tenant.id
      }]);

      if (error) throw error;

      broadcastTenantChange(tenant.id);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
        audio.volume = 0.5;
        await audio.play();
      } catch (audioErr) {
        console.warn('Audio play blocked:', audioErr);
      }

      setWaiterCallCooldown(30);
    } catch (err) {
      console.error('Error calling waiter:', err);
      alert('Error al llamar al mozo. Por favor intenta nuevamente.');
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // Theme colors
  const primaryColor = tenant.theme_colors?.primary || '#f97316';
  const secondaryColor = tenant.theme_colors?.secondary || '#1e293b';

  // La sincronización en tiempo real ahora es gestionada por useRealtimeData(tenant.id)
  // eliminando la necesidad de fetchData local y suscripciones manuales.

  // Función para calcular stock disponible en base a los ingredientes requeridos y el carrito actual
  const getPendingUsage = (ingredientId: string) => {
    let usage = 0;
    
    // Buscar el ingrediente para obtener sus departamentos
    const ingredient = ingredients.find(i => i.id === ingredientId);
    const ingDepts = ingredient?.target_departments || ['kitchen'];
    
    orders.forEach(order => {
      if (!order.is_archived && order.items) {
        order.items.forEach(item => {
          if (item.status === 'pending') {
            // Verificar si el ítem de la comanda corresponde al departamento del ingrediente
            const itemDepts = item.target_departments || ['kitchen'];
            const hasDeptOverlap = ingDepts.some(d => itemDepts.includes(d));
            
            if (hasDeptOverlap) {
              const recipe = productIngredients.filter(pi => pi.product_id === item.product_id);
              const req = recipe.find(pi => pi.ingredient_id === ingredientId);
              if (req) {
                usage += req.quantity_used * item.quantity;
              }
            }
          }
        });
      }
    });
    return usage;
  };

  const getAvailableStockForProduct = (productId: string, currentCart: CartItem[] = cart) => {
    if (loading) return 0;
    const recipe = productIngredients.filter(pi => pi.product_id === productId);
    if (recipe.length === 0) return Infinity;
    const ingredientUsageInCart: Record<string, number> = {};
    currentCart.forEach(item => {
        const itemRecipe = productIngredients.filter(pi => pi.product_id === item.id);
        itemRecipe.forEach(req => {
            ingredientUsageInCart[req.ingredient_id] = (ingredientUsageInCart[req.ingredient_id] || 0) + (req.quantity_used * item.quantity);
        });
    });
    let maxPossible = Infinity;
    for (const req of recipe) {
      const ingredient = ingredients.find(i => i.id === req.ingredient_id);
      if (!ingredient) return 0;
      
      const usedAlready = ingredientUsageInCart[req.ingredient_id] || 0;
      const pendingUsed = getPendingUsage(req.ingredient_id); // <-- Restar uso de comandas activas
      const remainingStock = ingredient.stock_level - usedAlready - pendingUsed;
      
      const isWeightProduct = products.find(p => p.id === productId)?.sale_by_weight || products.find(p => p.id === productId)?.is_fractionable;
      const canMake = isWeightProduct 
        ? (remainingStock / req.quantity_used)
        : Math.floor(remainingStock / req.quantity_used);
      if (canMake < maxPossible) maxPossible = canMake;
    }
    
    return Math.max(0, maxPossible);
  };

  const performAddToCart = (product: Product, answerNote?: string, customQty: number = 1) => {
    const availableNow = getAvailableStockForProduct(product.id);
    
    if (availableNow < customQty) {
        alert("¡Lo sentimos! No queda stock suficiente para añadir más.");
        return;
    }

    const activeOffer = getActiveOfferForProduct(product.id);
    const finalPrice = activeOffer 
      ? Math.round(product.price * (1 - activeOffer.discount_percentage / 100)) 
      : product.price;

    const productWithPrice = { ...product, price: finalPrice };

    setCart((prev) => {
      const existingIndex = prev.findIndex(item => item.id === product.id && item.notes === answerNote);
      if (existingIndex >= 0) {
        return prev.map((item, index) => index === existingIndex ? { ...item, quantity: item.quantity + customQty } : item);
      }
      return [...prev, { ...productWithPrice, cartItemId: crypto.randomUUID(), quantity: customQty, notes: answerNote }];
    });
  };

  const addToCart = (product: Product) => {
    if (product.sale_by_weight || product.is_fractionable) {
      setWeightModalProduct(product);
      setWeightInput('');
      return;
    }
    if (product.custom_question) {
      setQuestionModalProduct(product);
      setQuestionModalAnswer('');
      return;
    }
    performAddToCart(product);
  };

  const handleConfirmWeight = () => {
    if (!weightModalProduct) return;
    const grams = parseFloat(weightInput);
    if (isNaN(grams) || grams < 10) {
      alert("Por favor, ingresá una cantidad válida (mínimo 10 gramos).");
      return;
    }
    
    const kilos = grams / 1000;
    const tempProduct = weightModalProduct;
    
    setWeightModalProduct(null);
    setWeightInput('');
    
    if (tempProduct.custom_question) {
      setQuestionModalProduct(tempProduct);
      setQuestionModalAnswer('');
      setPendingWeightQty(kilos);
    } else {
      performAddToCart(tempProduct, undefined, kilos);
    }
  };


  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
        const item = prev.find(i => i.cartItemId === cartItemId);
        if (!item) return prev;

        const isWeight = item.sale_by_weight || item.is_fractionable;
        const step = isWeight ? 0.1 : 1;

        if (delta > 0) {
            const availableNow = getAvailableStockForProduct(item.id);
            if (availableNow < step) {
                alert("¡Lo sentimos! No queda stock suficiente.");
                return prev;
            }
        }

        return prev.map(i => {
            if (i.cartItemId === cartItemId) {
                const newQ = i.quantity + (delta * step);
                return newQ > 0 ? { ...i, quantity: Math.round(newQ * 100) / 100 } : i;
            }
            return i;
        });
    });
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const cartProductsTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = deliveryType === 'delivery' && selectedDeliveryZone ? selectedDeliveryZone.fee : 0;
  
  // Cubierto (Table Charge) - Se cobra si está habilitado y es pedido de mesa
  const tableCharge = tenant?.table_charge_enabled && deliveryType === 'local' && (tableName || tableParamId) 
      ? (tenant.table_charge_amount || 0) 
      : 0;

  // Propina (Tip)
  let calculatedTip = 0;
  if (tenant?.tips_enabled && deliveryType !== 'delivery') {
      if (tipPercentage === -1) {
          calculatedTip = parseFloat(customTip) || 0;
      } else {
          calculatedTip = Math.round((cartProductsTotal * tipPercentage) / 100);
      }
  }

  const cartTotal = cartProductsTotal + deliveryFee + tableCharge + calculatedTip;
  const cartCount = cart.reduce((acc, item) => acc + (item.sale_by_weight || item.is_fractionable ? 1 : item.quantity), 0);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.is_offer && !b.is_offer) return -1;
      if (!a.is_offer && b.is_offer) return 1;
      return 0;
    });
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const activeCatObj = categories.find(c => c.id === activeCategory);
    const isOfferCategory = activeCatObj
      ? (activeCatObj.is_offer === true || /oferta|oportunidad|descuento/i.test(activeCatObj.name))
      : false;

    return products.filter(p => {
      // Desactivación lógica (Soft Delete): Ocultar productos inactivos del menú digital
      if (p.is_active === false) return false;

      // Filtro de Huérfanos: Solo mostrar productos cuya categoría EXISTA actualmente en la lista
      const categoryExists = categories.some(c => c.id === p.category_id);
      if (!categoryExists) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (isOfferCategory) {
        return !!getActiveOfferForProduct(p.id);
      }

      const matchesCat = activeCategory === 'all' || p.category_id === activeCategory;
      if (!matchesCat) return false;

      return true;
    });
  }, [products, categories, activeCategory, searchQuery, productOffers, orders]);

  const submitOrderToSupabase = async (
    paymentStatus: 'pendiente' | 'pagado', 
    isApproved: boolean, 
    method: string, 
    skipSuccessUI: boolean = false, 
    externalOrderId?: string,
    customerFiadoId?: string
  ): Promise<string | undefined> => {
    setIsSubmitting(true);
    try {

      // Asignación automática inteligente si la mesa no tiene mozo asignado
      let assignedWaiterName: string | null = null;
      let targetTableNumber = tableParamId || tableName || null;
      let finalTableNumber: string | null = null;
      
      if (targetTableNumber && tenant) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('tables')
          .eq('id', tenant.id)
          .single();

        const { data: employeesData } = await supabase
          .from('employees')
          .select('name')
          .eq('tenant_id', tenant.id)
          .eq('role', 'waiter');

        if (tenantData) {
          const currentTables = Array.isArray(tenantData.tables) ? tenantData.tables : [];
          const currentWaiters = employeesData || [];
          
          const matchedTableIndex = currentTables.findIndex((t: any) => {
              const tableIdLower = (t.id || '').toLowerCase().trim();
              const tableNameLower = (t.name || '').toLowerCase().trim();
              const searchStr = targetTableNumber.toLowerCase().trim();

              if (tableIdLower === searchStr || tableNameLower === searchStr) return true;

              const numMatchSearch = searchStr.match(/\d+/);
              if (numMatchSearch) {
                  const num = numMatchSearch[0];
                  const numMatchName = tableNameLower.match(/\d+/);
                  if (numMatchName && numMatchName[0] === num) return true;
                  const numMatchId = tableIdLower.match(/\d+/);
                  if (numMatchId && numMatchId[0] === num) return true;
                  if (tableIdLower.includes(num)) return true;
              }
              return false;
          });
          
          if (matchedTableIndex !== -1) {
            const matchedTable = currentTables[matchedTableIndex];
            finalTableNumber = matchedTable.id;
            
            if (!matchedTable.waiter_name && currentWaiters.length > 0) {
              const waiterLoads: Record<string, number> = {};
              currentWaiters.forEach((w: any) => { waiterLoads[w.name] = 0; });
              currentTables.forEach((t: any) => {
                if (t.waiter_name && waiterLoads[t.waiter_name] !== undefined) {
                  waiterLoads[t.waiter_name]++;
                }
              });
              
              let bestWaiter = currentWaiters[0];
              let minLoad = waiterLoads[bestWaiter.name] || 0;
              currentWaiters.forEach((w: any) => {
                const load = waiterLoads[w.name] || 0;
                if (load < minLoad) { minLoad = load; bestWaiter = w; }
              });
              
              assignedWaiterName = bestWaiter.name;
              const updatedTables = currentTables.map((t: any, idx: number) => {
                if (idx === matchedTableIndex) return { ...t, waiter_name: assignedWaiterName };
                return t;
              });
              
              await supabase.from('tenants').update({ tables: updatedTables }).eq('id', tenant.id);
            } else if (matchedTable.waiter_name) {
              assignedWaiterName = matchedTable.waiter_name;
            }
          }
        }
      }

      if (!finalTableNumber) finalTableNumber = targetTableNumber || null;

      let finalCustomerInfo = customerInfo.trim() || tableParamId || tableName || 'Salón';
      if (giftMode.isActive) {
        finalCustomerInfo = `🎁 REGALO: Entregar en ${giftMode.toTable}`;
      } else if (deliveryType === 'delivery') {
        finalCustomerInfo = `${customerInfo.trim() || 'Cliente'} (Envío)`;
      } else if (deliveryType === 'llevar') {
        finalCustomerInfo = `${customerInfo.trim() || 'Cliente'} (Take Away)`;
      }

      const finalPhoneNumber = deliveryPhone ? `${phonePrefix} ${deliveryPhone.trim()}` : '';
      let loyaltyRedemption = 0;
      if (useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false) {
        const config = tenant.loyalty_config || {};
        const redeemChannel = config.redeem_channel || 'both';
        const isOnlineAllowed = redeemChannel === 'both' || redeemChannel === 'online';

        if (isOnlineAllowed) {
          loyaltyRedemption = Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount);
        }
      }

      const finalTotal = Math.max(0, cartTotal - appliedDiscount - loyaltyRedemption);
      let customerTabId = null;

      if (method === 'fiado' && customerFiadoId) {
        const { data: openTabs } = await supabase.from('customer_tabs')
            .select('*')
            .eq('customer_id', customerFiadoId)
            .eq('is_settled', false)
            .order('created_at', { ascending: false })
            .limit(1);

        let tab = openTabs && openTabs.length > 0 ? openTabs[0] : null;

        if (!tab) {
            const now = new Date();
            const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
            const { data: newTab } = await supabase.from('customer_tabs').insert({
                tenant_id: tenant.id,
                customer_id: customerFiadoId,
                period_start: start,
                period_end: start,
                total_debt: 0,
                amount_paid: 0
            }).select().single();
            if (newTab) tab = newTab;
        }

        if (tab) {
            customerTabId = tab.id;
            await supabase.from('customer_tabs')
                .update({ total_debt: Number(tab.total_debt) + finalTotal })
                .eq('id', tab.id);
        }
      }

      let createdOrder: any = null;
      let orderError: any = null;

      const firstAttempt = await supabase
        .from('orders')
        .insert([{
          ...(externalOrderId ? { id: externalOrderId } : {}),
          client_name: finalCustomerInfo,
          table_number: deliveryType === 'local' ? finalTableNumber : null,
          total_price: finalTotal,
          discount_amount: appliedDiscount,
          coupon_code: couponCode ? couponCode.trim().toUpperCase() : '',
          status: 'pending',
          phone_number: deliveryType === 'delivery' ? finalPhoneNumber : (finalPhoneNumber || ''),
          tenant_id: tenant.id,
          waiter_name: deliveryType === 'local' ? assignedWaiterName : null,
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'delivery' ? `${deliveryAddress} (Zona: ${selectedDeliveryZone?.name || 'General'})` : '',
          delivery_map_link: deliveryType === 'delivery' ? deliveryMapLink : '',
          delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
          delivery_lat: deliveryType === 'delivery' ? deliveryLat : null,
          delivery_lng: deliveryType === 'delivery' ? deliveryLng : null,
          payment_status: paymentStatus,
          payment_method: method,
          is_approved_for_production: isApproved,
          afip_billing_requested: afipBillingRequested,
          afip_client_type: afipBillingRequested ? afipClientType : 'consumidor_final',
          afip_doc_type: afipBillingRequested ? afipDocType : 'DNI',
          afip_doc_number: afipBillingRequested ? afipDocNumber : '',
          loyalty_discount_applied: loyaltyRedemption,
          tip_amount: calculatedTip,
          table_charge: tableCharge,
          customer_tab_id: customerTabId,
          is_tip_paid: false
        }])
        .select()
        .single();

      createdOrder = firstAttempt.data;
      orderError = firstAttempt.error;

      if (orderError) throw orderError;
      if (!createdOrder) throw new Error("No se pudo obtener el pedido creado");

      if (loyaltyRedemption > 0 && loyaltyAccount) {
        await supabase
          .from('loyalty_accounts')
          .update({ balance: Math.max(0, (parseFloat(loyaltyAccount.balance) || 0) - loyaltyRedemption) })
          .eq('id', loyaltyAccount.id);
      }

      if (createdOrder && validatedReservation) {
        try {
          if (validatedReservation.type === 'reservation') {
            const { error: burnError } = await supabase
              .from('reservations')
              .update({ is_deposit_applied: true, status: 'completed' })
              .eq('id', validatedReservation.data.id);
            if (burnError) throw burnError;
          } else if (validatedReservation.type === 'discount_code') {
            const { error: burnError } = await supabase
              .from('discount_codes')
              .update({ is_used: true })
              .eq('id', validatedReservation.data.id);
            if (burnError) throw burnError;
          }
          setAppliedDiscount(0);
          setValidatedReservation(null);
          setCouponCode('');
          setCouponSuccess('');
        } catch (err) {
          console.error('Error al quemar código:', err);
        }
      }

      const orderItemsToInsert: any[] = [];
      const giftNoteBase = giftMode.isActive ? `🎁 REGALO PARA: ${giftMode.toTable} | DE: ${giftMode.isAnonymous ? 'Alguien Misterioso' : giftMode.fromTable}` : '';
      
      cart.forEach(item => {
        const finalNotes = [giftNoteBase, item.notes].filter(Boolean).join(' | ');
        const product = products.find(p => p.id === item.id);
        const category = categories.find(c => c.id === product?.category_id);
        const catDepts = category?.target_departments || ['kitchen'];

        if (catDepts.length === 1) {
          orderItemsToInsert.push({
            order_id: createdOrder.id, product_id: item.id, quantity: item.quantity, unit_price: item.price,
            status: 'pending', tenant_id: tenant.id, target_departments: catDepts, notes: finalNotes
          });
          return;
        }

        const recipe = productIngredients.filter(pi => pi.product_id === item.id);
        if (recipe.length === 0) {
          orderItemsToInsert.push({
            order_id: createdOrder.id, product_id: item.id, quantity: item.quantity, unit_price: item.price,
            status: 'pending', tenant_id: tenant.id, target_departments: ['kitchen'], notes: finalNotes
          });
          return;
        }

        const deptsMap: Record<string, string[]> = {};
        recipe.forEach(ri => {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : ['kitchen'];
          depts.forEach(d => {
            if (!deptsMap[d]) deptsMap[d] = [];
            if (ing) deptsMap[d].push(ing.name);
          });
        });

        const deptsFound = Object.keys(deptsMap);
        if (deptsFound.length <= 1) {
          orderItemsToInsert.push({
            order_id: createdOrder.id, product_id: item.id, quantity: item.quantity, unit_price: deptsFound.length === 1 ? item.price : 0, 
            status: 'pending', tenant_id: tenant.id, target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen'], notes: finalNotes
          });
        } else {
          deptsFound.forEach((d, idx) => {
            const splitNote = deptsMap[d].join(' + ');
            orderItemsToInsert.push({
              order_id: createdOrder.id, product_id: item.id, quantity: item.quantity, unit_price: idx === 0 ? item.price : 0,
              status: 'pending', tenant_id: tenant.id, target_departments: [d], notes: finalNotes ? `${finalNotes} - ${splitNote}` : splitNote
            });
          });
        }
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (itemsError) throw itemsError;

      if (finalTableNumber && deliveryType === 'local') {
        try {
          const { data: tenantData } = await supabase.from('tenants').select('tables').eq('id', tenant.id).single();
          if (tenantData && Array.isArray(tenantData.tables)) {
            const updatedTables = tenantData.tables.map((t: any) => t.id === finalTableNumber ? { ...t, is_occupied: true } : t);
            await supabase.from('tenants').update({ tables: updatedTables }).eq('id', tenant.id);
            broadcastTenantChange(tenant.id);
          }
        } catch (e) { console.error("Error al marcar mesa ocupada:", e); }
      }

      const notifyRoles = ['admin'];
      if (deliveryType === 'local') notifyRoles.push('waiter');
      if (deliveryType === 'delivery') notifyRoles.push('delivery');

      const destName = deliveryType === 'local' ? (giftMode.isActive ? giftMode.toTable : (tableName || tableParamId || 'Mesa Local')) : 'Mostrador/Delivery';
      const notifMsg = `🔔 Pedido para ${destName} (De: ${finalCustomerInfo}) #${createdOrder.order_number}`;

      await supabase.from('app_notifications').insert([{
          message: notifMsg,
          type: 'info',
          target_roles: notifyRoles,
          tenant_id: tenant.id
      }]);

      if (giftMode.isActive) {
        try {
          await supabase.from('social_interactions').insert([{
            tenant_id: tenant.id, type: 'gift', sender_name: giftMode.isAnonymous ? 'Alguien Misterioso' : giftMode.fromTable,
            is_anonymous: giftMode.isAnonymous, content: `Regalo para: ${giftMode.toTable}${giftMode.giftHint ? ` | Mensaje: "${giftMode.giftHint}"` : ''}`,
            status: 'pending'
          }]);
        } catch (e) { console.error("Error publicando regalo", e); }
      }

      if (!skipSuccessUI) {
        if (giftMode.isActive) setGiftMode({ isActive: false, fromTable: '', toTable: '', isAnonymous: false, giftHint: '' });
        setSuccessOrderNumber(createdOrder.order_number);
        setOrderSuccess(true);
        setCart([]);
      }
      return createdOrder.id;

    } catch (err: any) {
      console.error("Error al procesar pedido", err);
      alert("Error al procesar tu pedido. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeCheckout = async () => {
    if (isSubmitting) return;

    if (paymentMethod === 'mercadopago' || paymentMethod === 'credito') {
      if (!tenant?.mercadopago_access_token) {
        alert("⚠️ Error: Falta configurar Mercado Pago.");
        return;
      }
      setIsSubmitting(true);
      try {
        setIsRedirectingToPayment(true);
        const externalOrderId = crypto.randomUUID();
        const response = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            external_reference: externalOrderId,
            items: [{ title: `Pedido en ${tenant.name}`, unit_price: Math.max(0, cartTotal - appliedDiscount), quantity: 1, currency_id: 'ARS' }],
            back_urls: {
              success: window.location.origin + window.location.pathname,
              failure: window.location.origin + window.location.pathname,
              pending: window.location.origin + window.location.pathname
            }
          })
        });

        const data = await response.json();
        if (data.init_point) {
          await submitOrderToSupabase('pendiente', false, paymentMethod, true, externalOrderId);
          window.location.href = data.init_point;
        } else {
          throw new Error(data.error || "Error al generar pasarela de pago");
        }
      } catch (err: any) {
        console.error(err);
        // Como nunca llegamos a llamar a submitOrderToSupabase, no hay pedidos que borrar ni notificaciones fantasma enviadas.
        alert("Error al iniciar el pago online: " + err.message);
        setIsSubmitting(false);
        setIsRedirectingToPayment(false);
      }
    } else {
      setIsSubmitting(true);
      await submitOrderToSupabase('pendiente', deliveryType === 'local' ? true : false, 'efectivo');
    }
  };

  const handleCheckout = async () => {
    if (isSubmitting) return; // Protección absoluta contra doble click

    if (cart.length === 0) return;
    
    if (deliveryType === 'delivery') {
      if (!selectedDeliveryZone) return alert("⚠️ Por favor selecciona tu Zona de Envío.");
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para la entrega.");
      if (!deliveryAddress.trim()) return alert("⚠️ Por favor ingresa la Dirección de Envío completa.");
      if (!deliveryPhone.trim()) return alert("⚠️ Por favor ingresa tu Teléfono celular de contacto celular.");
    } else if (deliveryType === 'llevar') {
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para retirar el pedido.");
      if (!deliveryPhone.trim()) return alert("⚠️ Por favor ingresa tu Teléfono celular.");
    } else {
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para que podamos identificar tu pedido en la mesa.");
    }

    // Validación PREVENTIVA estricta de AFIP (Evitar enviar pedido si falta CUIT)
    if (afipBillingRequested && afipClientType !== 'consumidor_final') {
        if (!afipDocNumber || afipDocNumber.replace(/\D/g, '').length !== 11) {
            alert("⚠️ ERROR: Debes ingresar un CUIT válido de 11 dígitos para facturar a Responsable Inscripto o Monotributista.");
            return; // Bloquear ejecución aquí mismo
        }
    }

    // Validación de Stock Real
    for (const item of cart) {
      const available = getAvailableStockForProduct(item.id, []); // [] para calcular el total disponible
      if (item.quantity > available) {
        alert(`¡Lo sentimos! No hay suficiente stock para "${item.name}". Disponible: ${available}`);
        return;
      }
    }

    // Modal Anti-Olvido: Si no ingresó ningún descuento ni reserva, avisarle preventivamente
    if (appliedDiscount === 0 && !couponCode.trim()) {
        setShowAntiForgetModal(true);
        setPendingAction(() => executeCheckout);
        return;
    }

    executeCheckout();
  };



  const renderReviewsSection = () => {
    return (
      <div className="w-full">
        {/* SECCIÓN DE RESEÑAS / OPINIONES DE CLIENTES */}
        {reviewsEnabled && (
          <section className="mt-12 pt-8 border-t border-neutral-900/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Opiniones de Clientes ⭐
                </h2>
                <p className="text-sm text-neutral-400 mt-1">
                  Lo que dicen nuestros comensales sobre nosotros de forma 100% transparente.
                </p>
              </div>
              
              <button
                onClick={() => {
                  setNewReviewName('');
                  setNewReviewRating(5);
                  setNewReviewComment('');
                  setIsReviewModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-bold text-sm shadow-xl shadow-white/5 hover:scale-105 active:scale-95 transition-all w-fit"
              >
                <Star className="w-4 h-4 fill-current text-amber-500" />
                Dejar mi Reseña
              </button>
            </div>

            {isReviewsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 bg-neutral-900/20 border border-neutral-900/50 rounded-3xl p-6">
                <p className="text-neutral-500 text-sm">Aún no hay opiniones. ¡Sé el primero en compartir tu experiencia!</p>
              </div>
            ) : (
              /* Lista / Carrusel de Reseñas */
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
                {reviews.map((rev) => (
                  <div 
                    key={rev.id}
                    className="snap-start flex-shrink-0 w-80 bg-neutral-900/40 border border-neutral-900/60 backdrop-blur-sm p-5 rounded-3xl space-y-3 relative hover:border-neutral-800 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm truncate max-w-[180px]">{rev.client_name}</h4>
                          <p className="text-[10px] text-neutral-500">
                            {new Date(rev.created_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        {/* Estrellas */}
                        <div className="flex gap-0.5 text-amber-400 bg-amber-400/5 px-2 py-1 rounded-lg border border-amber-400/10">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-3 h-3 ${i < rev.rating ? 'fill-current' : 'text-neutral-700'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed italic line-clamp-3">
                        "{rev.comment || 'Sin comentario, calificado con estrellas.'}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (isSessionExpired) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center p-6 text-center transition-colors duration-500 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-white'}`}>
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4 tracking-tight">Sesión Expirada</h2>
        <div className={`p-6 rounded-2xl mb-8 max-w-md border shadow-lg ${isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'}`}>
          <p className={`text-base mb-5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Por seguridad, el acceso directo a la mesa tiene un límite de 90 minutos (1 hora y media).
          </p>
          <div className={`p-4 rounded-xl flex items-start gap-3 text-left ${isLight ? 'bg-amber-50 border border-amber-100 text-amber-800' : 'bg-amber-500/10 border border-amber-500/20 text-amber-200'}`}>
            <Utensils className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-semibold mb-1">¿Aún estás en el local?</p>
              <p className="text-sm opacity-90 leading-relaxed">Por favor, vuelve a escanear el código QR que se encuentra en tu mesa para continuar pidiendo.</p>
            </div>
          </div>
        </div>
        
        <div className="w-full max-w-md">
          <a 
            href={`/${tenant.slug}/menu`}
            className={`w-full flex flex-col items-center justify-center gap-2 px-6 py-5 rounded-2xl border-2 transition-all group ${
              isLight 
                ? 'border-slate-300 hover:border-slate-400 hover:shadow-md bg-white text-slate-800' 
                : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 bg-neutral-900 text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-lg">
              <Home className="w-6 h-6 transition-transform group-hover:scale-110" style={{ color: primaryColor }} />
              Menú de Envíos a Domicilio
            </div>
            <span className={`text-sm text-center font-medium px-4 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Si estás en tu casa y quieres pedir Delivery o Retirar por el local, haz clic aquí.
            </span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {showSplash && (
        <div className="fixed inset-0 z-[100] bg-[#111111] flex flex-col items-center justify-center animate-out fade-out duration-700 delay-2000 fill-mode-forwards pointer-events-none">
          <div className="animate-in zoom-in-75 fade-in duration-1000 ease-out flex flex-col items-center">
             <img src="/tlqq_logo.jpg" alt="Todo Lo Que Quiero" className="w-40 h-40 rounded-[2.5rem] shadow-[0_0_60px_rgba(255,255,255,0.05)] object-cover mb-2 border border-white/5" />
             <div className="mt-6 text-center space-y-1.5">
                 <h2 className="text-white font-black text-2xl tracking-wide italic">mmmTodoLoQueQuiero</h2>
                 <p className="text-amber-500 text-[9px] font-black uppercase tracking-[0.3em]">Cargando Menú...</p>
             </div>
          </div>
          <div className="absolute bottom-12 w-full text-center opacity-40">
             <span className="text-[9px] text-white/50 uppercase tracking-[0.25em] font-black">Aplicación creada por TodoLoQueQuiero</span>
          </div>
        </div>
      )}
    <div className={`min-h-screen pb-24 font-sans selection:bg-neutral-800 transition-colors duration-500 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-white'}`}>
      
      {/* PANTALLA DE CARGA PREMIUM MERCADO PAGO */}
      {isRedirectingToPayment && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-350">
          <div className="relative flex flex-col items-center max-w-sm w-11/12 p-8 text-center bg-neutral-950/90 border border-neutral-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {/* Círculo loader animado */}
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-neutral-850 animate-pulse"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"
                style={{ borderTopColor: primaryColor }}
              ></div>
              {/* Icono central de tarjeta/pago */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: primaryColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-xl font-bold tracking-tight text-white mb-2">
              Procesando tu pedido...
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-6">
              Estamos preparando la pasarela de pago seguro. Serás redirigido a Mercado Pago en unos instantes.
            </p>
            
            {/* Barra de progreso de carga micro-animada */}
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full rounded-full animate-pulse"
                style={{ 
                  backgroundColor: primaryColor,
                  width: '65%',
                  transition: 'width 2s ease-in-out'
                }}
              ></div>
            </div>
            
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Pago Seguro Protegido
            </span>
          </div>
        </div>
      )}

      {/* Botón Flotante Cambiador de Tema Claro/Oscuro */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-[200] p-3 rounded-full shadow-2xl transition-all active:scale-90 border backdrop-blur-md ${
          isLight 
            ? 'bg-white/80 border-slate-200 text-slate-800 shadow-slate-200/50 hover:bg-slate-50' 
            : 'bg-neutral-900/80 border-neutral-800 text-yellow-400 shadow-black/50 hover:bg-neutral-850'
        }`}
        aria-label="Cambiar tema"
      >
        {isLight ? <Moon size={20} className="fill-slate-800 text-slate-800" /> : <Sun size={20} className="fill-yellow-400 text-yellow-400" />}
      </button>

      {/* PORTADA ESTILO RED SOCIAL */}
      <div className="relative w-full h-44 md:h-60 bg-neutral-900 overflow-hidden">
        {bannerUrl ? (
          <img 
            src={bannerUrl} 
            alt="Portada del local" 
            className="w-full h-full object-cover animate-in fade-in duration-500"
          />
        ) : (
          <div 
            className="w-full h-full opacity-60"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}20, #0a0a0a, ${primaryColor}10)`,
              backgroundImage: `radial-gradient(circle at 20% 30%, ${primaryColor}15, transparent 50%), radial-gradient(circle at 80% 70%, ${primaryColor}10, transparent 50%)`
            }}
          />
        )}
        {/* Degradado oscuro inferior para transicionar con el fondo general */}
        <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent transition-all duration-500 ${isLight ? 'from-slate-50 via-slate-50/40' : 'from-neutral-950 via-neutral-950/40'}`} />
      </div>

      {/* INFORMACIÓN DEL LOCAL CON FOTO DE PERFIL SUPERPUESTA */}
      <div className="max-w-4xl mx-auto px-4 pb-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-5 -mt-16 md:-mt-24 mb-4 text-center md:text-left">
          {/* Foto de perfil circular con efecto Glow */}
          <div className="relative group flex-shrink-0 flex items-center justify-center">
            {/* Efecto Glow / Luz de fondo */}
            <div 
              className="absolute -inset-2 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition duration-1000" 
              style={{ backgroundColor: primaryColor }} 
            />
            <div 
              className={`relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-105 ${isLight ? 'border-slate-50' : 'border-neutral-950'}`}
              style={{ 
                boxShadow: isLight ? '0 8px 32px rgba(99, 102, 241, 0.15)' : `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px ${primaryColor}20`
              }}
            >
              {profilePictureUrl ? (
                <img 
                  src={profilePictureUrl} 
                  alt={tenant.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Utensils className="w-12 h-12 md:w-16 md:h-16" style={{ color: primaryColor }} />
              )}
            </div>
          </div>

          {/* Info del Local y Enlaces */}
          <div className="flex-1 space-y-2 pt-2 md:pt-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex flex-col items-center justify-center md:items-start md:justify-start">
                  <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-md transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {tenant.name}
                  </h1>
                  {tenant.description && (
                    <p className={`mt-2 text-sm font-medium leading-relaxed max-w-xl text-center md:text-left ${
                      isLight ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      {tenant.description.length > 120 ? `${tenant.description.substring(0, 120)}...` : tenant.description}
                      {tenant.description.length > 120 && (
                        <button 
                          onClick={() => setIsInfoModalOpen(true)}
                          className="ml-2 font-bold hover:underline"
                          style={{ color: primaryColor }}
                        >
                          Ver más
                        </button>
                      )}
                    </p>
                  )}
                </div>
                
                {/* Badge de Promedio de Estrellas */}
                {reviewsEnabled && (
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                    <div className="flex items-center text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <Star className="w-3.5 h-3.5 fill-current mr-1 text-amber-400" />
                      <span>{avgRating}</span>
                    </div>
                    <span className={`text-xs font-medium transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      ({totalReviews} {totalReviews === 1 ? 'opinión' : 'opiniones'})
                    </span>
                  </div>
                )}
              </div>

              {/* Enlaces Sociales */}
              <div className="flex items-center justify-center gap-2">
                {socialLinks.instagram && (
                  <a 
                    href={socialLinks.instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-pink-500 hover:border-pink-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-pink-500 hover:border-pink-500/30'
                    }`}
                    title="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.facebook && (
                  <a 
                    href={socialLinks.facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-blue-500 hover:border-blue-500/30'
                    }`}
                    title="Facebook"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.whatsapp && (
                  <a 
                    href={`https://wa.me/${formatWhatsAppNumber(socialLinks.whatsapp)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-green-500 hover:border-green-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-green-500 hover:border-green-500/30'
                    }`}
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                )}
                {tenant?.business_hours?.enabled && (
                  <button 
                    onClick={() => setIsHoursModalOpen(true)}
                    className={`p-2.5 px-4 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg font-bold text-xs uppercase tracking-widest ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-700 hover:text-amber-500 hover:border-amber-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-amber-400 hover:border-amber-500/30'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Horarios</span>
                  </button>
                )}
              </div>
            </div>

            {/* INDICADOR DE MESAS LIBRES Y BOTÓN DE RESERVA */}
            {reservationsEnabled && !tableParamId && (
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 mt-4 border rounded-3xl backdrop-blur-sm transition-all duration-550 ${isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-neutral-900/30 border-neutral-900/60'}`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-500">
                    {freeTablesCount} {freeTablesCount === 1 ? 'Mesa Libre' : 'Mesas Libres'} ahora
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsReservationModalOpen(true);
                    setReservationName('');
                    setReservationPhone('');
                    setReservationPhonePrefix('+54');
                    setReservationDate('');
                    setReservationTime('');
                    setReservationPartySize(2);
                  }}
                  className={`w-full sm:w-auto px-5 py-2.5 font-black text-xs uppercase tracking-wider rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg text-center ${
                    isLight ? 'bg-slate-900 text-white shadow-slate-200/50' : 'bg-white text-black shadow-black/30'
                  }`}
                >
                  📅 Reservar Mesa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GIFT MODE BANNER */}
      {giftMode.isActive && (
        <div className="sticky top-0 z-[45] mx-4 md:mx-auto max-w-4xl p-3 bg-gradient-to-r from-amber-500 to-amber-500 rounded-b-2xl shadow-xl animate-in slide-in-from-top flex items-center justify-between border-x border-b border-amber-400/30">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-white/20 rounded-lg">
              <Gift className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="font-black uppercase text-xs md:text-sm leading-tight tracking-wider text-white drop-shadow-md">Modo Regalo</p>
              <p className="text-[10px] md:text-xs opacity-90 text-amber-50 mt-0.5">Comprando para la <b>{giftMode.toTable}</b></p>
            </div>
          </div>
          <button 
            onClick={() => setGiftMode({ isActive: false, fromTable: '', toTable: '', isAnonymous: false, giftHint: '' })}
            className="text-[10px] md:text-xs font-bold px-3 py-2 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors uppercase tracking-wider"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* BUSCADOR COMPACTO STICKY (Oculto en Landing) */}
      {!showLanding && (
        <>
        <div 
          className={`sticky top-0 z-40 backdrop-blur-xl border-b p-4 transition-all duration-300 ${
            isLight ? 'bg-slate-50/80 border-slate-200/60 shadow-sm' : 'bg-neutral-950/80 border-neutral-900/60'
          }`}
          style={{ borderBottomColor: isLight ? undefined : `${primaryColor}15` }}
        >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {tenant?.landing_config?.enabled && (
              <button
                onClick={goToLanding}
                className={`px-4 py-2.5 rounded-2xl border transition-all flex items-center justify-center shrink-0 gap-2 font-bold text-sm ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md' 
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                }`}
                title="Atrás"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Atrás</span>
              </button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="¿Qué se te antoja?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-800/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all placeholder:text-neutral-500 focus:border-white focus:ring-1 focus:ring-white focus:bg-neutral-900"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 pt-6 space-y-8">
        
        {/* Píldoras de Categorías */}
        <section>
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
            <button
              onClick={() => setActiveCategory('all')}
              className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === 'all' 
                  ? (isLight ? 'bg-slate-900 text-white shadow-lg shadow-slate-200/50' : 'bg-white text-black shadow-lg shadow-white/10')
                  : (isLight ? 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white')
              }`}
            >
              Todo
            </button>
            {sortedCategories.map(cat => {
              const isOfferCat = cat.is_offer === true || /oferta|oportunidad|descuento/i.test(cat.name);

              if (isOfferCat) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border bg-gradient-to-r from-amber-500 via-red-500 to-purple-600 text-white border-transparent shadow-[0_0_25px_rgba(249,115,22,0.5)] ${
                      activeCategory === cat.id 
                        ? 'scale-110 animate-pulse' 
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>🔥</span>
                    <span>{cat.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-tighter bg-white text-red-600 shadow-md animate-pulse">
                      ¡Aprovechá!
                    </span>
                  </button>
                );
              }

              const imageUrl = (cat as any).image_url;
              if (imageUrl) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border relative overflow-hidden group min-w-[120px] justify-center ${
                      activeCategory === cat.id 
                        ? (isLight ? 'border-slate-900 text-white shadow-md scale-105' : 'border-white shadow-[0_0_25px_rgba(255,255,255,0.25)] scale-105 text-white')
                        : (isLight ? 'border-slate-200 text-slate-700 hover:border-slate-400' : 'border-neutral-800 text-neutral-200 hover:border-neutral-600')
                    }`}
                  >
                    {/* Imagen de fondo */}
                    <img 
                      src={imageUrl} 
                      alt={cat.name} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {/* Filtro Oscuro encima de la imagen */}
                    <div className={`absolute inset-0 transition-colors ${
                      activeCategory === cat.id 
                        ? 'bg-neutral-950/70' 
                        : 'bg-neutral-950/80 group-hover:bg-neutral-950/70'
                    }`} />
                    
                    {/* Contenido (Icono y Nombre) */}
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                      <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border ${
                    activeCategory === cat.id 
                      ? (isLight ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-105')
                      : (isLight ? 'bg-slate-100 text-slate-650 border-slate-200 hover:border-slate-350 hover:bg-slate-200/50' : 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:border-neutral-600')
                  }`}
                >
                  <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>{cat.icon}</span> {cat.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Grilla de Productos */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const availableStock = getAvailableStockForProduct(product.id);
            const isSoldOut = availableStock <= 0;

            return (
            <div 
              key={product.id} 
              className={`group rounded-2xl overflow-hidden transition-all duration-300 flex ${
                isSoldOut ? 'opacity-70 grayscale-[0.5]' : ''
              } ${
                isLight 
                  ? 'bg-white border border-slate-200/60 shadow-sm md:hover:shadow-md md:hover:bg-slate-50/50' 
                  : 'bg-neutral-900/40 border border-neutral-800/60 md:hover:bg-neutral-900/80'
              }`}
            >
              {/* Imagen (placeholder visual estético si no hay image_url) */}
              <div className="w-1/3 min-h-[120px] bg-neutral-800 relative overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                    <Utensils className="w-8 h-8 text-neutral-700" />
                  </div>
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-neutral-900/40 md:to-neutral-900/20" />
              </div>
              
              {/* Contenido de la Tarjeta */}
              <div className="w-2/3 p-4 flex flex-col justify-between relative">
                <div>
                  <h3 className={`font-semibold line-clamp-1 transition-colors ${isLight ? 'text-slate-900' : 'text-neutral-100'}`}>{product.name}</h3>
                  {product.description ? (
                    <div className="mt-1">
                      <button 
                        onClick={() => toggleProductDesc(product.id)}
                        className={`flex items-center gap-1 text-[10px] uppercase font-bold transition-colors ${
                          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Descripción {expandedProducts[product.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <div className={`grid transition-all duration-300 ease-in-out ${expandedProducts[product.id] ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                        <div className="overflow-hidden">
                          <div className="max-h-28 overflow-y-auto custom-scrollbar pr-2 py-1">
                            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-xs mt-1 line-clamp-1 leading-relaxed ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      Delicioso y preparado al momento.
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  {(() => {
                    const activeOffer = getActiveOfferForProduct(product.id);
                    const isWeight = product.sale_by_weight || product.is_fractionable;
                    const suffix = isWeight ? ' / kg' : '';

                    if (activeOffer && !isSoldOut) {
                      const offerPrice = Math.round(product.price * (1 - activeOffer.discount_percentage / 100));
                      return (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-lg text-purple-600 dark:text-purple-400">
                              ${offerPrice.toLocaleString('es-AR')}{suffix}
                            </span>
                            <span className="text-[9px] bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-md font-black uppercase">
                              {activeOffer.discount_percentage}% OFF
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 line-through font-bold">
                            ${product.price.toLocaleString('es-AR')}{suffix}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <span className="font-bold text-lg" style={{ color: isSoldOut ? '#64748b' : (isLight ? '#0f172a' : primaryColor) }}>
                        ${product.price.toLocaleString('es-AR')}{suffix}
                      </span>
                    );
                  })()}
                  
                  {isSoldOut ? (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-black uppercase text-neutral-600 tracking-widest">Temporalmente</span>
                        <span className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                          Agotado 🚫
                        </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center md:hover:scale-110 active:scale-95 transition-all shadow-md ${
                        isLight ? 'bg-slate-900 text-white shadow-slate-200/50 md:hover:bg-slate-800' : 'bg-white text-black md:hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500">
              No encontramos productos en esta categoría.
            </div>
          )}
        </section>

        {/* SECCIÓN DE UBICACIÓN Y MAPA */}
        {(socialLinks.address || socialLinks.google_maps_url || socialLinks.maps_iframe) && (
          <section className="mt-12 pt-8 border-t border-neutral-900/60 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Nuestra Ubicación 📍
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Ven a disfrutar de la mejor experiencia gastronómica en nuestro local.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-neutral-950/40 border border-neutral-900/60 rounded-[2.5rem] p-6 backdrop-blur-md shadow-2xl">
              {/* Información y dirección */}
              <div className="md:col-span-5 flex flex-col justify-center space-y-5">
                {socialLinks.address && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-neutral-500 tracking-widest block">Dirección</span>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-white font-bold text-sm leading-relaxed">{socialLinks.address}</p>
                    </div>
                  </div>
                )}

                {socialLinks.google_maps_url && (
                  <div className="pt-2">
                    <a
                      href={socialLinks.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5 w-full md:w-fit"
                    >
                      <Map className="w-4 h-4 text-amber-500" />
                      Abrir en Google Maps
                    </a>
                  </div>
                )}
              </div>

              {/* Mapa interactivo */}
              {socialLinks.maps_iframe && (
                <div className="md:col-span-7 h-[250px] md:h-[300px] w-full rounded-2xl overflow-hidden border border-neutral-900 shadow-xl relative">
                  <iframe
                    src={getMapIframeSrc(socialLinks.maps_iframe)}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={true}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación del Local"
                    className="absolute inset-0 w-full h-full opacity-85 hover:opacity-100 transition-opacity"
                  ></iframe>
                </div>
              )}
            </div>
          </section>
        )}

        {renderReviewsSection()}
        {/* Powered by Mmm TodoLoQueQuiero Comer - Footer del Menú */}
        <GlobalWatermark />
      </main>
      </>
      )}

      {/* LANDING PAGE CONTENT */}
      {showLanding && (
        <main className="w-full min-h-screen bg-black overflow-x-hidden animate-in fade-in zoom-in-95 duration-500 pb-40 relative">
          {/* Fondo Estrellado Animado (opcional para dar más "wow") */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black opacity-80 pointer-events-none" />
          {/* SECCIÓN PRINCIPAL: IMAGEN DE AMBIENTE / CARRUSEL */}
          {(tenant?.landing_config?.hero_style === 'image' || tenant?.landing_config?.hero_style === 'video') && (
            <div className="relative w-full h-64 md:h-96 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-0 rounded-b-[2rem] md:rounded-b-[4rem]">
              {tenant?.landing_config?.hero_style === 'video' && tenant?.landing_config?.hero_video_url ? (
                <video 
                  src={tenant.landing_config.hero_video_url}
                  autoPlay loop muted playsInline
                  className="w-full h-full object-cover scale-105"
                  style={{ objectPosition: tenant?.landing_config?.hero_position || 'center' }}
                />
              ) : (
                <img 
                  src={tenant.landing_config.hero_image_url}
                  alt="Ambiente del local"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: tenant?.landing_config?.hero_position || 'center' }}
                />
              )}
              {/* Overlay Gradient suave para fusionar con el fondo negro */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-90" />
            </div>
          )}

          <div className={`relative z-20 max-w-5xl mx-auto px-4 ${tenant?.landing_config?.hero_style !== 'gradient' ? '-mt-12 md:-mt-20' : 'mt-8'} space-y-16`}>
            
            {/* NUESTRA ESENCIA (ABOUT US) */}
            {tenant?.landing_config?.about_text && (
              <section className="text-center max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                <div className="p-8 md:p-12 rounded-[3rem] bg-neutral-900/50 border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest drop-shadow-lg mb-6">Nuestra Esencia</h2>
                  <p className="text-slate-300 text-base md:text-lg leading-relaxed font-medium whitespace-pre-wrap">
                    {tenant.landing_config.about_text}
                  </p>
                </div>
              </section>
            )}

            {/* CARRUSEL DINÁMICO (CUSTOM CAROUSEL) */}
            {tenant?.landing_config?.custom_carousel?.length > 0 && (
              <section className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">
                    Novedades
                  </h2>
                </div>
                
                <AutoCarousel gapClass="gap-4 md:gap-6">
                  {tenant.landing_config.custom_carousel.map((slide: any) => (
                    <div key={slide.id} className="min-w-[300px] md:min-w-[400px] snap-center bg-neutral-900/60 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl relative group">
                      <div className="h-64 md:h-72 w-full bg-neutral-800 relative overflow-hidden">
                        {(slide.image_url || (slide.id === 'def-1' ? '/defaults/carousel1.png' : slide.id === 'def-2' ? '/defaults/carousel2.png' : slide.id === 'def-3' ? '/defaults/carousel3.png' : '')) ? (
                          <img 
                            src={slide.image_url || (slide.id === 'def-1' ? '/defaults/carousel1.png' : slide.id === 'def-2' ? '/defaults/carousel2.png' : slide.id === 'def-3' ? '/defaults/carousel3.png' : '')} 
                            alt={slide.title} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-purple-500/10">
                            <ImageIcon className="w-12 h-12 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                        
                        {slide.badge_text && (
                          <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl font-bold text-white text-xs border border-white/20 shadow-lg">
                            ✨ {slide.badge_text}
                          </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col justify-end">
                          <h3 className="text-xl md:text-2xl font-black text-white leading-tight mb-2 drop-shadow-md">{slide.title}</h3>
                          <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed drop-shadow-sm">{slide.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </AutoCarousel>
              </section>
            )}

            {/* CARRUSEL DE PRODUCTOS DESTACADOS */}
            {tenant?.landing_config?.featured_products_enabled && (
              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-green-500/20 text-green-500 border border-green-500/30">
                      <Utensils className="w-6 h-6 fill-current" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">
                      Lo Más Destacado
                    </h2>
                  </div>
                  <button onClick={goToMenu} className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1">
                    Ver Productos <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Scroll horizontal de productos */}
                <AutoCarousel gapClass="gap-4">
                  {products.filter(p => p.is_active !== false).slice(0, 6).map((product) => (
                    <div key={product.id} className="min-w-[260px] md:min-w-[300px] snap-center bg-neutral-900/60 border border-white/5 rounded-3xl overflow-hidden shadow-xl hover:border-white/20 transition-all duration-300 flex flex-col cursor-pointer" onClick={goToMenu}>
                      <div className="h-48 w-full bg-neutral-800 relative overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-110 opacity-90 hover:opacity-100" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-800/50">
                            <Utensils className="w-10 h-10 text-neutral-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
                        <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl font-bold text-white text-sm shadow-lg border border-white/10">
                          ${product.price}
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-lg font-black text-white leading-tight mb-2 line-clamp-1">{product.name}</h3>
                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed flex-1">{product.description}</p>
                      </div>
                    </div>
                  ))}
                </AutoCarousel>
              </section>
            )}
            
            {/* PROMOS & BANNERS */}
            {tenant?.landing_config?.promos?.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">
                    Promociones
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tenant.landing_config.promos.map((promo: any) => (
                    <div key={promo.id} className="relative rounded-[2rem] overflow-hidden group border border-white/5 shadow-2xl bg-neutral-900/50 hover:border-white/20 transition-all duration-500 hover:-translate-y-2">
                      <div className="aspect-[4/3] w-full bg-black relative overflow-hidden">
                        {promo.image_url ? (
                          <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-purple-500/10">
                            <Gift className="w-12 h-12 text-white/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                      </div>
                      <div className="absolute bottom-0 inset-x-0 p-6 space-y-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                        <h3 className="text-xl font-black text-white uppercase tracking-wider drop-shadow-md">{promo.title}</h3>
                        <p className="text-sm text-slate-300 font-medium drop-shadow-md line-clamp-2">{promo.subtitle}</p>
                        {promo.cta_text && promo.cta_link && (
                          <div className="pt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                            <a href={promo.cta_link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                              {promo.cta_text} <ChevronRight className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* EVENTOS */}
            {tenant?.landing_config?.events?.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <BellRing className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">
                    Próximos Eventos
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {tenant.landing_config.events.map((ev: any) => (
                    <div key={ev.id} className="p-5 rounded-[2rem] border border-white/5 space-y-4 hover:border-purple-500/40 transition-all duration-300 shadow-xl group bg-white/5 backdrop-blur-md relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      {ev.image_url && (
                        <div className="w-full h-36 rounded-2xl overflow-hidden bg-black border border-white/5 relative">
                          <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </div>
                      )}
                      <div className="relative z-10">
                        <div className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-[9px] font-black uppercase tracking-widest mb-3 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                          📅 {ev.date || 'Próximamente'}
                        </div>
                        <h3 className="text-lg font-black text-white leading-tight uppercase tracking-wide group-hover:text-purple-300 transition-colors">{ev.title}</h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-3">{ev.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Muro Interactivo Social Dining */}
            {tenant?.landing_config?.interactive_wall_enabled !== false && (
              <section className="pt-8">
                <div className="relative">
                  {/* Decoración detrás del muro */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 rounded-[3rem] blur-xl opacity-50" />
                  <div className="relative">
                    <SocialWall 
                      tenantId={tenant?.id || ''} 
                      primaryColor={primaryColor} 
                      isLight={false}
                      hasPremiumVIP={tenant?.hasPremiumVIP}
                      currentTable={tableName || tableParamId}
                      tables={tenant?.tables || []}
                      onStartGiftMode={(from, to, anon, hint) => {
                        setGiftMode({ isActive: true, fromTable: from, toTable: to, isAnonymous: anon, giftHint: hint });
                        setDeliveryType('local');
                        goToMenu();
                      }}
                    />
                  </div>
                </div>
              </section>
            )}
            
            {/* RESEÑAS EN LANDING */}
            <div className="mt-8 pb-12">
              {renderReviewsSection()}
            </div>
            {/* Powered by Mmm TodoLoQueQuiero Comer - Footer del Landing */}
            <GlobalWatermark />
          </div>
        </main>
      )}

      {/* FAB - Botón Flotante Animado para Landing */}
      {showLanding && (
        <div className="fixed bottom-10 inset-x-0 flex justify-center z-[200] pointer-events-none">
          <button
            onClick={goToMenu}
            className="pointer-events-auto relative group flex items-center justify-center px-8 py-4 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.6)] active:scale-95 transition-all animate-bounce font-black text-white uppercase tracking-widest border border-white/20 hover:shadow-[0_0_40px_rgba(249,115,22,0.8)] overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            <Utensils className="w-5 h-5 mr-3 animate-pulse" />
            <span className="drop-shadow-md">Ver Productos</span>
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-white"></div>
          </button>
        </div>
      )}

      {/* FAB - Botón Flotante para volver a la Landing */}
      {!showLanding && tenant?.landing_config?.enabled && (
        <div className="fixed bottom-24 right-4 z-40 flex justify-end animate-in fade-in slide-in-from-right-4 duration-500">
          <button
            onClick={goToLanding}
            className="flex items-center gap-2 px-4 py-3 rounded-full font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95 border"
            style={{ 
              backgroundColor: isLight ? '#ffffff' : '#000000', 
              color: primaryColor, 
              borderColor: `${primaryColor}40`,
              boxShadow: `0 10px 25px -5px ${primaryColor}40`
            }}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider hidden md:inline">Portada / Muro</span>
          </button>
        </div>
      )}


      {/* FAB - Botón de Carrito Flotante */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-40 px-4 animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full max-w-sm flex items-center justify-between px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md transition-transform md:hover:scale-[1.02] active:scale-[0.98] pointer-events-auto"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
              boxShadow: `0 10px 40px -10px ${primaryColor}` 
            }}
          >
            <div className="flex items-center gap-3">
              <div key={`count-${cartCount}`} className="bg-black/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {cartCount}
              </div>
              <span className="font-medium">Ver Pedido</span>
            </div>
            <span key={`total-${cartTotal}`} className="font-bold">${cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL ANTI-OLVIDO */}
      {showAntiForgetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`relative w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 border ${
            isLight ? 'bg-white border-slate-200 shadow-slate-300/50 text-slate-800' : 'bg-neutral-900 border-neutral-700 shadow-black/50 text-white'
          }`}>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">🎫</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">¿Tenés algún Código de Descuento?</h3>
              <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Recordá que si tenés un <b>Código Promocional</b> o una <b>Reserva Pagada</b>, debes ingresarlo ahora en el carrito antes de pagar.
                <br/><br/>
                <span className="text-red-500 font-bold uppercase text-xs tracking-wider">⚠️ No será válido presentarlo en el local.</span>
              </p>
              
              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => setShowAntiForgetModal(false)}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all border ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-white'
                  }`}
                >
                  🔙 Volver al Carrito
                </button>
                <button
                  onClick={() => {
                    setShowAntiForgetModal(false);
                    if (pendingAction) pendingAction();
                  }}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Procesando...' : '✅ No tengo código, Continuar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PREGUNTA PERSONALIZADA */}
      {questionModalProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setQuestionModalProduct(null)} />
          <div className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isLight ? 'bg-white text-slate-900' : 'bg-neutral-900 border border-neutral-800 text-white'}`}>
            <h3 className="text-xl font-black mb-2 text-center">
              Personalizá tu pedido
            </h3>
            <p className="text-center text-sm mb-6 opacity-80">
              {questionModalProduct.name}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">
                  {questionModalProduct.custom_question}
                  {questionModalProduct.is_question_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea
                  value={questionModalAnswer}
                  onChange={(e) => setQuestionModalAnswer(e.target.value)}
                  placeholder="Escribí tu respuesta acá..."
                  className={`w-full rounded-2xl p-4 min-h-[100px] outline-none transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-2 border-slate-200 focus:border-slate-800 focus:bg-white' 
                      : 'bg-black/50 border-2 border-neutral-800 focus:border-neutral-600 focus:bg-neutral-800'
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setQuestionModalProduct(null)}
                  className={`flex-1 py-3.5 rounded-2xl font-bold transition-all ${
                    isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (questionModalProduct.is_question_required && !questionModalAnswer.trim()) {
                      alert("Por favor, respondé la pregunta para continuar.");
                      return;
                    }
                    performAddToCart(questionModalProduct, questionModalAnswer.trim(), pendingWeightQty || 1);
                    setQuestionModalProduct(null);
                    setQuestionModalAnswer('');
                    setPendingWeightQty(null);
                  }}
                  className="flex-1 py-3.5 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PESO (Venta por Gramos/Kilos) */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWeightModalProduct(null)} />
          <div className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isLight ? 'bg-white text-slate-900 border border-slate-200' : 'bg-neutral-900 border border-neutral-800 text-white'}`}>
            <h3 className="text-xl font-black mb-2 text-center text-amber-500 uppercase tracking-wider">
              Venta por Peso
            </h3>
            <p className="text-center text-sm font-bold mb-4">
              {weightModalProduct.name}
            </p>
            <p className="text-center text-xs opacity-75 mb-6">
              Precio por Kilo: <span className="font-bold">${weightModalProduct.price.toLocaleString()}</span>
            </p>

            <div className="space-y-6">
              {/* Opciones rápidas */}
              <div>
                <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2.5">
                  Selección Rápida
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '100 g', value: 100 },
                    { label: '250 g', value: 250 },
                    { label: '500 g', value: 500 },
                    { label: '750 g', value: 750 },
                    { label: '1 kg', value: 1000 },
                    { label: '2 kg', value: 2000 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setWeightInput(opt.value.toString())}
                      className={`py-2 px-1 text-xs font-bold rounded-xl transition-all active:scale-95 border ${
                        weightInput === opt.value.toString()
                          ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                          : isLight
                          ? 'bg-slate-50 border-slate-205 text-slate-700 hover:bg-slate-100'
                          : 'bg-neutral-800 border-neutral-750 text-neutral-350 hover:bg-neutral-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input manual */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
                  O ingresá los gramos exactos:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="Ej. 350"
                    min="10"
                    className={`flex-1 rounded-2xl p-4 text-center text-lg font-bold outline-none transition-all ${
                      isLight
                        ? 'bg-slate-50 border-2 border-slate-200 focus:border-slate-800 focus:bg-white text-slate-900'
                        : 'bg-black/50 border-2 border-neutral-800 focus:border-neutral-600 focus:bg-neutral-800 text-white'
                    }`}
                  />
                  <span className="text-sm font-black uppercase tracking-wider text-neutral-450">Gramos</span>
                </div>
                <p className="text-[10px] text-center text-neutral-500 mt-2">
                  Mínimo 10g. El precio se calculará proporcionalmente.
                </p>
              </div>

              {/* Subtotal estimado */}
              {(() => {
                const grs = parseFloat(weightInput) || 0;
                const price = weightModalProduct.price;
                const subtotal = Math.round((grs / 1000) * price);
                if (grs <= 0) return null;
                return (
                  <div className={`p-3 rounded-2xl text-center border ${isLight ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-500/10 border-amber-500/20'}`}>
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block">Subtotal Estimado</span>
                    <span className="text-xl font-black text-amber-500">${subtotal.toLocaleString()}</span>
                  </div>
                );
              })()}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setWeightModalProduct(null);
                    setWeightInput('');
                  }}
                  className={`flex-1 py-3.5 rounded-2xl font-bold transition-all ${
                    isLight ? 'bg-slate-100 text-slate-650 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-350 hover:bg-neutral-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmWeight}
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay oscuro */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          />
          {/* Panel lateral derecho (Bottom sheet en móviles) */}
          <div className={`relative w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            {/* Cabecera Carrito */}
            <div className={`p-5 border-b flex items-center justify-between transition-colors ${
              isLight ? 'border-slate-200 bg-slate-50/50' : 'border-neutral-800 bg-neutral-900/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}20` }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <h2 className={`text-xl font-bold transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>Tu Pedido</h2>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  isLight ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>            {/* Lista de Ítems */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-5 space-y-6 flex-1">
                <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.cartItemId} className="flex gap-4 items-center">
                    {/* Foto miniatura */}
                    <div className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 transition-colors duration-500 ${isLight ? 'bg-slate-100' : 'bg-neutral-800'}`}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="w-5 h-5 text-neutral-600" />
                        </div>
                      )}
                    </div>
                    
                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium text-sm truncate transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.name}</h4>
                      <p className={`font-medium text-sm mt-0.5 transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                        {item.sale_by_weight || item.is_fractionable ? (
                          <>
                            <span className="font-extrabold text-amber-500">${Math.round(item.price * item.quantity).toLocaleString('es-AR')}</span>
                            <span className="text-[10px] opacity-60 ml-1.5">(${item.price.toLocaleString('es-AR')}/kg)</span>
                          </>
                        ) : (
                          `$${item.price.toLocaleString('es-AR')}`
                        )}
                      </p>
                      {item.notes && (
                        <p className={`text-xs mt-1 italic truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                          💬 {item.notes}
                        </p>
                      )}
                    </div>
                    
                    {/* Controles de Cantidad y Eliminar */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-3 rounded-full p-1 border transition-colors duration-500 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-500 ${
                            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`text-xs font-bold px-1 text-center transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'} whitespace-nowrap`}>
                          {item.sale_by_weight || item.is_fractionable ? (
                            item.quantity < 1 ? `${(item.quantity * 1000).toFixed(0)}g` : `${item.quantity.toFixed(1)}kg`
                          ) : (
                            item.quantity
                          )}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-500 ${
                            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Botón de Eliminar */}
                      <button 
                        onClick={() => removeCartItem(item.cartItemId)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-all ml-1"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {cart.length === 0 && (
                <div className="text-center py-20 text-neutral-500 flex flex-col items-center gap-4">
                  <ShoppingBag className="w-12 h-12 text-neutral-700" />
                  <p>Tu carrito está vacío</p>
                </div>
              )}

              {/* Formulario de Checkout e Información del Pedido */}
              {cart.length > 0 && (
                <div className="space-y-6 pt-6 border-t border-neutral-800 text-left">
                  {/* Selector de Tipo de Entrega (Take Away vs Delivery) si no es mesa */}
                  {!tableParamId ? (
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                        Método de Entrega
                      </label>
                      <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-inner">
                        <button
                          type="button"
                          onClick={() => setDeliveryType('llevar')}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            deliveryType === 'llevar'
                              ? 'bg-neutral-800 text-white shadow-md font-black border border-neutral-700/50'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          🛍️ Retirar / Take Away
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!tenant?.has_delivery) {
                              alert("⚠️ Servicio de Envíos no habilitado:\n\nEste local no cuenta con el servicio de envíos a domicilio habilitado en este momento. Por favor, selecciona la opción de Retirar en el Local.");
                            } else if (!isDeliveryActiveToday) {
                                let msg = "";
                                if (isDeliveryPanicActive) {
                                  msg = "⚠️ Envíos Suspendidos Temporalmente.\n\nEl servicio de delivery ha sido pausado por el local debido a alta demanda o razones de fuerza mayor. Por favor, selecciona la opción de Retirar en el Local.";
                                } else if (!isDeliveryHoursOpen) {
                                  msg = "⚠️ Envíos fuera de horario.\n\nEl servicio de envíos a domicilio no está operando en este momento. Por favor, selecciona la opción de Retirar en el Local o intenta más tarde.";
                                } else {
                                  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                  const activeDaysNames = (tenantDeliveryDays as number[]).map(d => dayNames[d]).join(', ');
                                  msg = `⚠️ Envíos no disponibles hoy.\n\nDías de delivery activo:\n${activeDaysNames}`;
                                }
                                alert(msg);
                            } else {
                              setDeliveryType('delivery');
                            }
                          }}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            !isDeliveryActiveToday && tenant?.has_delivery
                                ? 'opacity-40 cursor-not-allowed bg-neutral-900/50 text-neutral-500 hover:text-neutral-500'
                                : deliveryType === 'delivery'
                                  ? 'bg-neutral-800 text-white shadow-md font-black border border-neutral-700/50'
                                  : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          🚚 Envío a Domicilio
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Campos Dinámicos según tipo de Entrega */}
                  {deliveryType === 'local' ? (
                    /* Pedido en Salón / Mesa */
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 block">
                          Mesa Asignada (Salón)
                        </label>
                        <input 
                          type="text" 
                          value={tableName || tableParamId || ''}
                          onChange={(e) => setTableName(e.target.value)}
                          placeholder="Ej: 3, Mesa 4, Patio..."
                          className="w-full bg-neutral-950 border border-purple-500/40 rounded-xl px-4 py-3 text-sm outline-none text-purple-400 font-bold focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre para identificarte..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </div>
                  ) : deliveryType === 'delivery' ? (
                    /* Pedido de Envío a Domicilio */
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Zona de Envío *
                        </label>
                        <select
                          value={selectedDeliveryZone ? JSON.stringify(selectedDeliveryZone) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedDeliveryZone(val ? JSON.parse(val) : null);
                          }}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none text-neutral-300 transition-all focus:border-white focus:ring-1 focus:ring-white cursor-pointer"
                        >
                          <option value="">-- Selecciona tu Zona de Envío --</option>
                          {Array.isArray(tenant?.delivery_zones) && tenant.delivery_zones.map((zone: any, idx: number) => (
                            <option key={idx} value={JSON.stringify(zone)}>
                              {zone.name} ({zone.fee === 0 ? 'Envío Gratis ($0)' : `$${zone.fee.toLocaleString('es-AR')}`})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Dirección Completa de Entrega *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Calle, Número, Departamento, Ciudad..."
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Enlace de Google Maps (Opcional)
                        </label>
                        <input 
                          type="text" 
                          placeholder="https://maps.app.goo.gl/..."
                          value={deliveryMapLink}
                          onChange={(e) => setDeliveryMapLink(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                        <p className="text-[9px] text-neutral-500 mt-1.5 leading-normal">
                          📍 Si sabes cómo obtener el enlace de tu ubicación, por favor colócalo. Esto ayudará a que la entrega sea más eficiente y tu pedido llegue lo antes posible.
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          WhatsApp / Teléfono de Contacto *
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-3 text-xs outline-none text-neutral-300 font-bold focus:border-white transition-all cursor-pointer"
                          >
                            <option value="+54">🇦🇷 +54 (AR)</option>
                            <option value="+56">🇨🇱 +56 (CL)</option>
                            <option value="+598">🇺🇾 +598 (UY)</option>
                            <option value="+591">🇧🇴 +591 (BO)</option>
                            <option value="+55">🇧🇷 +55 (BR)</option>
                            <option value="+51">🇵🇪 +51 (PE)</option>
                            <option value="+57">🇨🇴 +57 (CO)</option>
                            <option value="+595">🇵🇾 +595 (PY)</option>
                            <option value="+593">🇪🇨 +593 (EC)</option>
                            <option value="+58">🇻🇪 +58 (VE)</option>
                          </select>
                          <input 
                            type="tel" 
                            placeholder="Celular (ej: 9 11 1234-5678)"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>

                      {/* Geolocalizador / Mapa de Simulación Premium */}
                      <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Geolocalización GPS</span>
                          {deliveryLat && deliveryLng && (
                            <span className="text-[7px] bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded font-bold">
                              Fijado ✓
                            </span>
                          )}
                        </div>
                        
                        {/* Emulador visual del Mapa */}
                        <div className="h-28 bg-neutral-950 rounded-xl border border-neutral-800 relative overflow-hidden flex items-center justify-center group shadow-inner">
                          {/* Cuadrícula simulada estilo radar de mapa */}
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                          
                          {deliveryLat && deliveryLng ? (
                            <div className="text-center z-10 p-2 animate-in zoom-in duration-300">
                              <span className="text-3xl animate-bounce block">📍</span>
                              <p className="text-[8px] font-bold text-white uppercase mt-1">Ubicación Confirmada</p>
                              <p className="text-[7px] text-neutral-500 font-mono mt-0.5">{deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}</p>
                            </div>
                          ) : (
                            <div className="text-center z-10 p-4">
                              <span className="text-2xl text-neutral-600 block group-hover:scale-110 transition-transform">🗺️</span>
                              <p className="text-[8px] font-bold text-neutral-500 uppercase mt-1.5 leading-relaxed">
                                Pincha el botón para capturar tus coordenadas exactas y asegurar la ruta más rápida
                              </p>
                              <p className="text-[7px] text-amber-400 font-bold uppercase mt-2 animate-pulse">
                                ⚠️ Recordá elegir "Permitir" cuando tu celular te pida permiso.
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              alert("Tu navegador no soporta geolocalización.");
                              return;
                            }
                            setIsLocating(true);
                            
                            // Envolver en una función asíncrona protectora
                            const getPos = () => {
                              try {
                                navigator.geolocation.getCurrentPosition(
                                  (position) => {
                                    if (position && position.coords) {
                                      setDeliveryLat(position.coords.latitude || 0);
                                      setDeliveryLng(position.coords.longitude || 0);
                                    }
                                    setIsLocating(false);
                                  },
                                  (error) => {
                                    console.warn("GPS Denegado/Falla:", error);
                                    alert("El celular denegó el acceso al GPS. Por favor, escribí tu dirección y pegá tu link de Google Maps manualmente arriba.");
                                    setIsLocating(false);
                                  },
                                  { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
                                );
                              } catch (e) {
                                console.error("Excepción al intentar llamar al GPS nativo:", e);
                                alert("Ocurrió un error al intentar abrir el GPS. Por favor, usa la carga manual de Google Maps.");
                                setIsLocating(false);
                              }
                            };
                            
                            getPos();
                          }}
                          disabled={isLocating}
                          className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLocating ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Localizando GPS...
                            </span>
                          ) : (
                            <>📍 Obtener Mi Ubicación</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Pedido Take Away (Para Retirar) */
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre para el Retiro *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          WhatsApp de Contacto Celular *
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-3 text-xs outline-none text-neutral-300 font-bold focus:border-white transition-all cursor-pointer"
                          >
                            <option value="+54">🇦🇷 +54 (AR)</option>
                            <option value="+56">🇨🇱 +56 (CL)</option>
                            <option value="+598">🇺🇾 +598 (UY)</option>
                            <option value="+591">🇧🇴 +591 (BO)</option>
                            <option value="+55">🇧🇷 +55 (BR)</option>
                            <option value="+51">🇵🇪 +51 (PE)</option>
                            <option value="+57">🇨🇴 +57 (CO)</option>
                            <option value="+595">🇵🇾 +595 (PY)</option>
                            <option value="+593">🇪🇨 +593 (EC)</option>
                            <option value="+58">🇻🇪 +58 (VE)</option>
                          </select>
                          <input 
                            type="tel" 
                            placeholder="Celular (ej: 9 11 1234-5678)"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selector del Método de Pago */}
                  <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                    <label className={`text-xs font-semibold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('efectivo')}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center ${
                          paymentMethod === 'efectivo'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-white text-white shadow-lg')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">💵</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">Efectivo</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Pagas al recibir</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tenant?.mercadopago_public_key) {
                            alert("⚠️ Cobro Online no habilitado:\n\nEsta opción no está configurada para este local todavía. Por favor, selecciona otro método de pago (como Efectivo).");
                          } else {
                            setPaymentMethod('credito');
                          }
                        }}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center relative ${
                          paymentMethod === 'credito'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-amber-500 text-white shadow-lg shadow-amber-500/10')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">💳</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">Tarjeta</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Crédito / Débito</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tenant?.mercadopago_public_key) {
                            alert("⚠️ Mercado Pago no habilitado:\n\nEsta opción de pago online no está configurada para este local todavía. Por favor, selecciona otro método de pago (como Efectivo).");
                          } else {
                            setPaymentMethod('mercadopago');
                          }
                        }}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center relative ${
                          paymentMethod === 'mercadopago'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-blue-500 text-white shadow-lg shadow-blue-500/10')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">📱</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">M. Pago</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Billetera Virtual</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('fiado')}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center relative ${
                          paymentMethod === 'fiado'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-indigo-500 text-white shadow-lg shadow-indigo-500/10')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">📖</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">Fiado</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Cuenta Corriente</span>
                        </div>
                      </button>
                    </div>

                    {paymentMethod === 'fiado' && (
                        <FiadoOnboarding 
                            tenantId={tenant.id} 
                            onVerified={(id) => setFiadoCustomerId(id)} 
                        />
                    )}
                  </div>

                  {/* FACTURACIÓN AFIP (OPCIONAL Y SUTIL) */}
                  {(tenant as any)?.afip_enabled && (
                    <div className="pt-4 border-t border-neutral-800/50">
                      <button
                        type="button"
                        onClick={() => setAfipBillingRequested(!afipBillingRequested)}
                        className={`flex items-center gap-2 text-[10px] font-bold transition-colors w-full text-left ${afipBillingRequested ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${afipBillingRequested ? 'bg-blue-500 border-blue-500 text-white' : 'border-neutral-600 bg-neutral-900/50'}`}>
                          {afipBillingRequested && '✓'}
                        </span>
                        ¿Necesitás Factura AFIP (A, B o C)? (Opcional)
                      </button>

                      {afipBillingRequested && (
                        <div className="mt-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                          
                          {/* Explicación de tipo de factura según condición del local */}
                          <div className={`p-2.5 rounded-lg text-[9px] uppercase tracking-wider font-bold border ${isLight ? 'bg-blue-50/50 border-blue-200 text-blue-700' : 'bg-blue-900/20 border-blue-800/50 text-blue-300'}`}>
                            ℹ️ El local es {(tenant?.afip_condicion_iva || '').toLowerCase().includes('monotribut') ? 'Monotributista' : 'Responsable Inscripto'}.<br/>
                            {(tenant?.afip_condicion_iva || '').toLowerCase().includes('monotribut') 
                              ? 'Se emitirá Factura C para todos los casos.' 
                              : 'Se emitirá Factura B a Consumidores Finales / Monotributistas, y Factura A a Responsables Inscriptos.'}
                          </div>

                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">
                              Tipo de Receptor AFIP
                            </label>
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden p-1 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('consumidor_final');
                                  setAfipDocType('DNI');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'consumidor_final'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Cons. Final
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('monotributista');
                                  setAfipDocType('CUIT');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'monotributista'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Monotributista
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('responsable_inscripto');
                                  setAfipDocType('CUIT');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'responsable_inscripto'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Resp. Inscripto
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                              {afipClientType === 'consumidor_final' ? 'DNI / CUIT (Opcional)' : 'CUIT (Obligatorio)'}
                            </label>
                            <input
                              type="number"
                              value={afipDocNumber}
                              onChange={(e) => setAfipDocNumber(e.target.value)}
                              placeholder={afipClientType === 'consumidor_final' ? 'Ingresa tu DNI o dejalo vacío' : 'Ingresa tu CUIT sin guiones'}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none text-neutral-300 transition-all focus:border-white focus:ring-1 focus:ring-white"
                            />
                            {afipClientType === 'consumidor_final' && (
                              <p className="text-[8px] text-neutral-500 mt-1 font-medium">Para Consumidor Final, no es obligatorio el DNI para importes menores.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Footer de Checkout */}
            {cart.length > 0 && (
              <div className={`p-5 border-t backdrop-blur-lg space-y-4 ${
                isLight ? 'border-slate-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.04)]' : 'border-neutral-800 bg-neutral-900/80'
              }`}>
                
                {loyaltyAccount && tenant.loyalty_enabled !== false && (() => {
                  const config = tenant.loyalty_config || {};
                  const redeemChannel = config.redeem_channel || 'both';
                  const isOnlineAllowed = redeemChannel === 'both' || redeemChannel === 'online';

                  if (!isOnlineAllowed) return null;

                  return (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-[2rem] text-left space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-amber-400 flex items-center gap-1.5">
                          <Gift size={11} /> ¡Monedero Club Clientes! (Nivel {loyaltyAccount.tier.toUpperCase()})
                        </span>
                        <span className="text-xs font-black text-amber-400 font-mono">
                          ${parseFloat(loyaltyAccount.balance).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <p className="text-[7.5px] text-slate-400 font-bold uppercase leading-normal">
                        Tenés saldo acumulado en pesos de tus compras anteriores. ¿Querés descontarlo de este pedido?
                      </p>
                      <button
                        type="button"
                        onClick={() => setUseLoyaltyDiscount(!useLoyaltyDiscount)}
                        className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                          useLoyaltyDiscount
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {useLoyaltyDiscount ? '✓ Saldo Descontado' : 'Usar mi saldo acumulado'}
                      </button>
                    </div>
                  );
                })()}

                {/* INPUT DE CÓDIGO DE RESERVA / CUPÓN */}
                {reservationsEnabled && (
                  <div className={`p-4 border rounded-3xl space-y-2.5 transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200/80' : 'bg-neutral-900/40 border-neutral-800/80'
                  }`}>
                    <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      ¿Tienes un Código de Reserva o Cupón?
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ej: RES-M4T1"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className={`flex-1 border rounded-xl px-3 py-2 text-xs uppercase outline-none transition-all font-bold ${
                          isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-350 focus:border-slate-500' : 'bg-neutral-950 border-neutral-800/60 text-white placeholder:text-neutral-700 focus:border-white'
                        }`}
                        disabled={isValidatingCoupon || appliedDiscount > 0}
                      />
                      {appliedDiscount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedDiscount(0);
                            setValidatedReservation(null);
                            setCouponCode('');
                            setCouponSuccess('');
                          }}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-red-500/20 active:scale-95 transition-all"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleValidateCoupon}
                          disabled={isValidatingCoupon || !couponCode.trim()}
                          className="px-4 py-2 bg-white text-black font-extrabold rounded-xl text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                        >
                          {isValidatingCoupon ? '...' : 'Validar'}
                        </button>
                      )}
                    </div>
                    {couponError && (
                      <p className="text-[7.5px] font-bold text-red-500 uppercase tracking-wide ml-1">{couponError}</p>
                    )}
                    {couponSuccess && (
                      <p className="text-[7.5px] font-bold text-green-500 uppercase tracking-wide ml-1">{couponSuccess}</p>
                    )}
                  </div>
                )}
                {/* Selección de Propinas */}
                {tenant?.tips_enabled && deliveryType !== 'delivery' && (
                  <div className={`space-y-3 pt-3 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-neutral-800/50'}`}>
                    <div className="flex flex-col space-y-1">
                      <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                        <Gift size={12} className="text-amber-500" /> Propina para el equipo
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                        ¡Gracias por tu apoyo! (Opcional)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[0, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => setTipPercentage(percent)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                            tipPercentage === percent
                              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                              : isLight
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                          }`}
                        >
                          {percent}%
                        </button>
                      ))}
                      <button
                        onClick={() => setTipPercentage(-1)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          tipPercentage === -1
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                            : isLight
                              ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                        }`}
                      >
                        Otro
                      </button>
                    </div>
                    {tipPercentage === -1 && (
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>$</span>
                        <input
                          type="number"
                          value={customTip}
                          onChange={(e) => setCustomTip(e.target.value)}
                          placeholder="Monto exacto en $"
                          className={`w-full pl-7 pr-3 py-2.5 rounded-xl text-sm font-bold outline-none transition-colors ${
                            isLight 
                              ? 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-amber-500' 
                              : 'bg-neutral-950 border border-neutral-800 text-white focus:border-amber-500'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Desglose Financiero */}
                <div className={`space-y-1.5 pb-1 border-b ${isLight ? 'border-slate-100' : 'border-neutral-800/50'}`}>
                  <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    <span>Subtotal Productos</span>
                    <span>${cartProductsTotal.toLocaleString('es-AR')}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      <span>Envío a domicilio</span>
                      <span>${deliveryFee.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {tableCharge > 0 && (
                    <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      <span>Servicio de Mesa (Cubierto)</span>
                      <span>${tableCharge.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {calculatedTip > 0 && (
                    <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      <span>Propina al equipo</span>
                      <span>${calculatedTip.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {appliedDiscount > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-500 font-bold">
                      <span>Descuento / Reserva Aplicada</span>
                      <span>-${appliedDiscount.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {(() => {
                    const loyaltyRedemption = useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false
                      ? Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount)
                      : 0;
                    if (loyaltyRedemption <= 0) return null;
                    return (
                      <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                        <span>Descuento Monedero Club</span>
                        <span>-${loyaltyRedemption.toLocaleString('es-AR')}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between text-sm font-black uppercase tracking-wider">
                  <span className={`transition-colors duration-500 ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>Total a pagar</span>
                  <div className="flex flex-col items-end">
                    {(() => {
                      const loyaltyRedemption = useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false
                        ? Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount)
                        : 0;
                      const hasAnyDiscount = appliedDiscount > 0 || loyaltyRedemption > 0;
                      const displayTotal = Math.max(0, cartTotal - appliedDiscount - loyaltyRedemption);

                      return (
                        <>
                          {hasAnyDiscount && (
                            <span className="text-xs text-neutral-500 line-through font-bold">
                              ${cartTotal.toLocaleString('es-AR')}
                            </span>
                          )}
                          <span className={`text-lg transition-colors duration-500 ${isLight ? 'text-slate-900 font-extrabold' : 'text-white'}`} style={{ color: isLight ? undefined : primaryColor }}>
                            ${displayTotal.toLocaleString('es-AR')}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Footer de Acciones (Siempre visible aunque el carrito esté vacío, pero fluye con el contenido) */}
            <div className={`p-5 border-t shrink-0 mt-auto ${isLight ? 'border-slate-200 bg-white' : 'border-neutral-800 bg-neutral-950'}`}>
              {orderSuccess ? (
                <div className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in duration-500">
                  <CheckCircle className="w-12 h-12 mb-1" />
                  <div className="text-center">
                    <h4 className="text-xl font-black uppercase tracking-tighter italic">
                      {successOrderNumber === 0 ? '¡Pedido Pagado Online!' : `¡Pedido #${successOrderNumber} recibido!`}
                    </h4>
                    <p className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest mt-1">Ya estamos preparando tu orden</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col w-full rounded-xl overflow-hidden shadow-lg transition-all" style={{ boxShadow: cart.length === 0 ? 'none' : `0 8px 30px -10px ${primaryColor}` }}>
                  {!isBusinessOpen && cart.length > 0 && (
                    <div className="w-full bg-red-500/20 text-red-500 py-2.5 px-4 text-center text-xs font-black uppercase tracking-widest border-b border-red-500/20 backdrop-blur-sm">
                      ⚠️ Fuera de Horario de Atención
                    </div>
                  )}
                  {isBusinessOpen && tableCharge > 0 && cart.length > 0 && (
                    <div className="w-full bg-amber-500/10 text-amber-600 py-2.5 px-4 text-center text-[10px] font-black uppercase tracking-widest border-b border-amber-500/20 backdrop-blur-sm">
                      🍽️ Incluye Servicio de Mesa (${tableCharge.toLocaleString('es-AR')})
                    </div>
                  )}
                  <div className="flex w-full">
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className={`w-1/2 py-4 font-semibold transition-colors flex justify-center items-center text-xs uppercase tracking-widest ${
                        isLight ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-350' : 'text-neutral-300 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600'
                      }`}
                    >
                      Seguir Pidiendo
                    </button>
                    <button 
                      onClick={handleCheckout}
                      disabled={isSubmitting || cart.length === 0 || !isBusinessOpen}
                      className={`w-1/2 py-4 font-bold text-white transition-all flex justify-center items-center gap-2 text-xs uppercase tracking-widest ${
                        cart.length === 0 || !isBusinessOpen
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:brightness-110 active:brightness-90'
                      }`}
                      style={{ backgroundColor: (cart.length === 0 || !isBusinessOpen) ? (isLight ? '#94a3b8' : '#52525b') : primaryColor }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        !isBusinessOpen ? 'Cerrado' : 'Confirmar Pedido'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Botón Flotante "Llamar al Mozo" (Premium Glassmorphic y Arrastrable) */}
      {tableParamId && (
        <div 
          className="fixed z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 touch-none"
          style={{
            left: `${dragPosition.x}px`,
            bottom: `${dragPosition.y}px`
          }}
        >
          <button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleBtnClick}
            disabled={isCallingWaiter || waiterCallCooldown > 0}
            className={`flex items-center gap-2 px-5 py-4 rounded-full shadow-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-shadow text-[10px] font-black uppercase tracking-widest cursor-grab active:cursor-grabbing select-none ${
              waiterCallCooldown > 0
                ? 'bg-neutral-900/90 text-neutral-500 border-neutral-800'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-amber-500/20'
            }`}
            style={{
              boxShadow: waiterCallCooldown > 0 ? 'none' : '0 8px 30px rgba(249, 115, 22, 0.3)'
            }}
          >
            {isCallingWaiter ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : waiterCallCooldown > 0 ? (
              <>
                <span>⏳ Mozo en camino ({waiterCallCooldown}s)</span>
              </>
            ) : (
              <>
                <BellRing className="w-4 h-4 animate-bounce" />
                <span>Llamar al Mozo</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal Flotante de Presentación "Sobre Nosotros" */}
      {isInfoModalOpen && tenant.description && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`w-full max-w-md rounded-[2.5rem] p-6 border shadow-2xl space-y-6 text-center flex flex-col relative animate-in zoom-in-95 duration-300 backdrop-blur-xl ${
              isLight 
                ? 'bg-white/80 border-slate-200 text-slate-900' 
                : 'bg-neutral-950/80 border-white/5 text-white'
            }`}
          >
            {/* Botón de Cerrar */}
            <button 
              onClick={() => setIsInfoModalOpen(false)} 
              className={`absolute top-5 right-5 p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
                isLight 
                  ? 'bg-slate-100 border-slate-200/60 text-slate-500 hover:text-slate-900' 
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <X size={14} />
            </button>

            {/* Cabecera / Identidad */}
            <div className="flex flex-col items-center space-y-3 mt-2">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/20 bg-neutral-900 flex items-center justify-center shrink-0">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  <Utensils className="w-10 h-10 text-amber-500" />
                )}
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight italic text-amber-500" style={{ color: primaryColor }}>
                {tenant.name}
              </h3>
            </div>

            {/* Cuerpo / Descripción */}
            <div className="space-y-2 text-left">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block border-b border-white/5 pb-1">Sobre Nosotros</span>
              <p className={`text-xs font-medium leading-relaxed max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar ${isLight ? 'text-slate-600' : 'text-slate-350'}`}>
                {tenant.description}
              </p>
            </div>

            {/* Redes Sociales si están activas */}
            {(socialLinks.instagram || socialLinks.whatsapp) && (
              <div className="space-y-3 pt-3 border-t border-white/5 text-left">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block">Contacto & Redes</span>
                <div className="flex gap-2">
                  {socialLinks.instagram && (
                    <a 
                      href={socialLinks.instagram} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex-1 py-3 px-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isLight 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60' 
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Instagram size={12} className="text-amber-500" /> Instagram
                    </a>
                  )}
                  {socialLinks.whatsapp && (
                    <a 
                      href={`https://wa.me/${formatWhatsAppNumber(socialLinks.whatsapp)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex-1 py-3 px-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isLight 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60' 
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <MessageCircle size={12} className="text-amber-500" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Horarios de Atención */}
      {isHoursModalOpen && tenant?.business_hours && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setIsHoursModalOpen(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`w-full max-w-sm rounded-[2.5rem] p-6 border shadow-2xl space-y-6 text-center flex flex-col relative animate-in zoom-in-95 duration-300 backdrop-blur-xl ${
              isLight 
                ? 'bg-white/80 border-slate-200 text-slate-900' 
                : 'bg-neutral-950/80 border-white/5 text-white'
            }`}
          >
            <button 
              onClick={() => setIsHoursModalOpen(false)} 
              className={`absolute top-5 right-5 p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
                isLight 
                  ? 'bg-slate-100 border-slate-200/60 text-slate-500 hover:text-slate-900' 
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <X size={14} />
            </button>

            <div className="flex flex-col items-center space-y-3 mt-2">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/20 bg-neutral-900 flex items-center justify-center shrink-0">
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight italic text-amber-500" style={{ color: primaryColor }}>
                Horarios
              </h3>
            </div>

            <div className="space-y-1 text-left w-full mt-4">
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, index) => {
                const jsDayMap = [1, 2, 3, 4, 5, 6, 0];
                const dayIndex = jsDayMap[index];
                const dayShifts = tenant.business_hours.schedule?.[dayIndex] || [];
                
                const currentJsDay = new Date().getDay();
                const isToday = currentJsDay === dayIndex;

                return (
                  <div key={dayIndex} className={`flex justify-between items-center py-2 border-b border-white/5 last:border-0 ${isToday ? 'bg-amber-500/10 rounded-lg px-2 -mx-2 border-b-0' : ''}`}>
                    <span className={`font-bold text-xs uppercase tracking-widest ${isToday ? 'text-amber-500' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {dayName} {isToday && '(Hoy)'}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      {dayShifts.length > 0 ? (
                        dayShifts.map((shift: any, sIdx: number) => (
                          <span key={sIdx} className={`text-[11px] font-black bg-neutral-900/50 px-2 py-0.5 rounded-md border border-white/5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                            {shift.open} - {shift.close}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] font-bold text-red-500/80 uppercase bg-red-500/10 px-2 py-0.5 rounded-md">Cerrado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESERVAR MESA */}
      {isReservationModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsReservationModalOpen(false)}
          />
          <div className={`relative w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 border ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-950 border-neutral-900'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>📅 Reservar Mesa</h3>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>Completa los detalles de tu visita.</p>
              </div>
              <button 
                onClick={() => setIsReservationModalOpen(false)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                  isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seña informativa */}
              {reservationDepositAmount > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-500 block tracking-wider">Seña Requerida</span>
                  <span className={`text-lg font-black block ${isLight ? 'text-slate-900' : 'text-white'}`}>${reservationDepositAmount.toLocaleString()}</span>
                  <span className="text-[7.5px] text-slate-500 uppercase font-bold block">El importe será descontado de tu total en tu pedido final.</span>
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-1">
                <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>Tu Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-bold ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400' : 'bg-neutral-900/50 border-neutral-800 text-white focus:border-white focus:ring-1 focus:ring-white placeholder:text-neutral-600'
                  }`}
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1">
                <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>Teléfono de Contacto</label>
                <div className="flex gap-2">
                  <select
                    value={reservationPhonePrefix}
                    onChange={(e) => setReservationPhonePrefix(e.target.value)}
                    className={`border rounded-xl px-2.5 py-3 text-xs outline-none font-bold transition-all cursor-pointer ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-700 focus:border-slate-400' : 'bg-neutral-900 border-neutral-800 text-neutral-300 focus:border-white'
                    }`}
                  >
                    <option value="+54">🇦🇷 +54 (AR)</option>
                    <option value="+56">🇨🇱 +56 (CL)</option>
                    <option value="+598">🇺🇾 +598 (UY)</option>
                    <option value="+591">🇧🇴 +591 (BO)</option>
                    <option value="+55">🇧🇷 +55 (BR)</option>
                    <option value="+51">🇵🇪 +51 (PE)</option>
                    <option value="+57">🇨🇴 +57 (CO)</option>
                    <option value="+595">🇵🇾 +595 (PY)</option>
                    <option value="+593">🇪🇨 +593 (EC)</option>
                    <option value="+58">🇻🇪 +58 (VE)</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Celular (ej: 9 11 1234-5678)"
                    value={reservationPhone}
                    onChange={(e) => setReservationPhone(e.target.value)}
                    className={`flex-1 border rounded-xl px-4 py-3 text-sm outline-none transition-all font-bold ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400' : 'bg-neutral-900/50 border-neutral-800 text-white focus:border-white focus:ring-1 focus:ring-white placeholder:text-neutral-600'
                    }`}
                  />
                </div>
              </div>

              {/* Fecha y Hora en Fila */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>Día</label>
                  <input
                    type="date"
                    min={reservationDateLimits.min}
                    max={reservationDateLimits.max}
                    value={reservationDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReservationDate(val);
                      
                      if (val && val.length === 10) {
                        const selected = new Date(val + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const maxDate = new Date();
                        maxDate.setMonth(maxDate.getMonth() + 1);
                        maxDate.setHours(23,59,59,999);
                        
                        if (selected < today) {
                          alert("⚠️ No puedes seleccionar una fecha en el pasado.");
                          setReservationDate(reservationDateLimits.min);
                        } else if (selected > maxDate) {
                          alert("⚠️ Solo puedes reservar con un máximo de 1 mes de anticipación.");
                          setReservationDate(reservationDateLimits.min);
                        }
                      }
                    }}
                    style={{ colorScheme: isLight ? 'light' : 'dark' }}
                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-bold ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-400' : 'bg-neutral-900/50 border-neutral-800 text-white focus:border-white focus:ring-1 focus:ring-white'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>Hora</label>
                  {!reservationDate ? (
                    <div className={`w-full border rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-neutral-900/50 border-neutral-800 text-neutral-500'
                    }`}>
                      Selecciona un día
                    </div>
                  ) : availableReservationTimes.length > 0 ? (
                    <select
                      value={reservationTime}
                      onChange={(e) => setReservationTime(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all font-bold appearance-none ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-400' : 'bg-neutral-900/50 border-neutral-800 text-white focus:border-white focus:ring-1 focus:ring-white'
                      }`}
                      style={{ backgroundImage: isLight 
                        ? `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231e293b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`
                        : `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, 
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                    >
                      {availableReservationTimes.map((time) => (
                        <option key={time} value={time} className={isLight ? "bg-white text-slate-900" : "bg-neutral-900 text-white"}>
                          {time} hs
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-500 font-bold flex items-center justify-center">
                      Sin turnos disponibles
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad de personas */}
              <div className="space-y-1">
                <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>Cantidad de Personas</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setReservationPartySize(prev => Math.max(1, prev - 1));
                    }}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold transition-colors ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800'
                    }`}
                  >
                    -
                  </button>
                  <div className={`flex-1 border rounded-xl py-3 text-center font-bold text-sm ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-neutral-900/30 border-neutral-900 text-white'
                  }`}>
                    <span key={`party-size-${reservationPartySize}`} className="inline-block animate-in fade-in duration-200">
                      👥 {reservationPartySize} {reservationPartySize === 1 ? 'Persona' : 'Personas'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReservationPartySize(prev => prev + 1);
                    }}
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold transition-colors ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800'
                    }`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReservationModalOpen(false)}
                className={`flex-1 py-3 rounded-2xl transition-all font-bold text-sm ${
                  isLight ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReservation}
                disabled={isSubmittingReservation}
                className={`flex-1 py-3 rounded-2xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${
                  isLight ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-black'
                }`}
              >
                {isSubmittingReservation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{reservationDepositAmount > 0 ? 'Pagar Seña' : 'Confirmar Reserva'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASARELA VIRTUAL DE PAGO DE SEÑA MERCADO PAGO */}
      {isMpReservationModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-md" 
            onClick={() => {
              if (!isMpReservationPaying && !isMpReservationSuccess) {
                setIsMpReservationModalOpen(false);
              }
            }}
          />
          
          <div className="relative w-full max-w-sm bg-neutral-950 border border-neutral-900 rounded-[2.5rem] p-6 space-y-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {isMpReservationSuccess && (
              <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  ✓
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">¡Seña Acreditada!</h3>
                  <p className="text-xs text-neutral-300 font-bold px-2 leading-relaxed">
                    Tu reserva fue tomada correctamente, en breve recibirás un mensaje con todos los datos de tu reserva.
                  </p>
                </div>

                <div className="w-full p-4 bg-neutral-900/40 border border-neutral-900 rounded-2xl space-y-2 mt-4">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">Código Único de Reserva</span>
                  <span className="text-2xl font-black text-amber-500 tracking-wider block">{generatedReservationCode}</span>
                  <span className="text-[7px] text-slate-500 uppercase font-bold block leading-relaxed">Presenta este código al mozo o ingrésalo en el carrito de compras para descontar tu seña.</span>
                </div>

                <button
                  onClick={() => setIsMpReservationModalOpen(false)}
                  className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  OK, lo leí todo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL DE DEJAR RESEÑA */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsReviewModalOpen(false)}
          />
          <div className="relative bg-neutral-950 border border-neutral-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white">Dejar mi Reseña</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Comparte tu opinión con la comunidad.</p>
              </div>
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="space-y-4">
              {/* Selector de Estrellas */}
              <div className="space-y-2 text-center py-2 bg-neutral-900/30 rounded-2xl border border-neutral-900">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                  Calificación
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReviewRating(star)}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star 
                        className={`w-8 h-8 transition-colors ${
                          star <= newReviewRating 
                            ? 'text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                            : 'text-neutral-700'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">
                  Tu Nombre
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={newReviewName}
                  onChange={(e) => setNewReviewName(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-neutral-600"
                  required
                />
              </div>

              {/* Comentario */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">
                  Comentario
                </label>
                <textarea
                  placeholder="Cuéntanos qué te pareció la comida, la atención y el ambiente..."
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  rows={4}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all resize-none placeholder:text-neutral-600"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="flex-1 py-3 rounded-2xl bg-white text-black hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Enviar Reseña</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Éxito Premium de Pedido */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            className={`w-full max-w-md rounded-[2.5rem] p-8 border shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6 ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' 
                : 'glass border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white'
            }`}
          >
            {/* Ícono animado de éxito */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle className="w-10 h-10 animate-bounce" />
              <div className="absolute -inset-1 rounded-full border border-green-500/10 animate-ping opacity-75" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight italic bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                ¡Pedido Recibido con Éxito!
              </h3>
              <div className="inline-flex bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                Orden #{successOrderNumber}
              </div>
            </div>

            <div className={`text-sm leading-relaxed ${isLight ? 'text-slate-650' : 'text-neutral-350'}`}>
              {tableParamId ? (
                <>
                  <p className="font-extrabold text-green-400 text-base">¡Gracias por la compra!</p>
                  <p className="mt-1.5 font-bold">Tu pedido ya está siendo preparado.</p>
                  <p className="mt-0.5 text-xs text-slate-400">En cuanto esté listo, se acercarán a tu mesa.</p>
                  <div className="text-[10.5px] leading-relaxed font-bold mt-4 border-t border-white/5 pt-3.5 space-y-1.5 text-center">
                    <p className="text-amber-400 uppercase tracking-wider text-[9px] font-black">🛎️ ¿Tienes alguna duda o quieres asistencia?</p>
                    <p className={isLight ? 'text-slate-600 font-extrabold' : 'text-neutral-400'}>
                      Recuerda que tienes un botón ahí en el menú para **llamar al mozo cuando quieras**, en el momento que quieras. ¡No dudes en utilizarlo ante cualquier inquietud!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-extrabold text-green-400 text-base">¡Muchas gracias por tu compra!</p>
                  <p className="mt-1.5 font-bold">Tu pedido ya está siendo preparado con dedicación.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {deliveryType === 'delivery' ? 'Te avisaremos cuando esté en camino con el repartidor.' : 'Te avisaremos cuando esté listo para retirar en mostrador.'}
                  </p>
                </>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="space-y-3 pt-4">
              <button
                onClick={() => {
                  setOrderSuccess(false);
                  setSuccessOrderNumber(null);
                  setIsCartOpen(false);
                }}
                className={`w-full py-4 font-black text-xs uppercase tracking-widest rounded-2xl border transition-all active:scale-95 ${
                  isLight 
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-650 hover:text-slate-900 shadow-sm' 
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
