import { useState, useEffect } from 'react';

// Utilidad para convertir la VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(deviceFingerprint: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Error checking subscription', err);
    }
  };

  const subscribeToPush = async () => {
    if (!deviceFingerprint) {
      console.warn('Cannot subscribe to push without a valid device fingerprint');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Obtener la llave VAPID del servidor
      const response = await fetch('/api/vapidPublicKey');
      const vapidData = await response.json();
      const convertedVapidKey = urlBase64ToUint8Array(vapidData.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Enviar la suscripción al backend para guardarla en active_devices
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceFingerprint,
          subscription,
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Error al suscribirse a notificaciones push:', error);
      return false;
    }
  };

  return { isSupported, isSubscribed, subscribeToPush };
}
