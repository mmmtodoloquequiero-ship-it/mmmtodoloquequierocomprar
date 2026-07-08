/**
 * Sanitiza números de celular de Argentina para formatearlos de acuerdo
 * a los requerimientos de la API de WhatsApp (wa.me), asegurando el prefijo 549
 * y eliminando el 15 si se ingresó.
 */
export const cleanArgPhone = (phone: string): string => {
  if (!phone) return '';
  
  // 1. Limpiar todos los caracteres no numéricos
  let digits = phone.replace(/\D/g, '');
  
  if (!digits) return '';

  // 2. Extraer el número nacional sin código de país o cero inicial
  let national = digits;
  if (digits.startsWith('549')) {
    national = digits.substring(3);
  } else if (digits.startsWith('54')) {
    national = digits.substring(2);
  }
  
  if (national.startsWith('0')) {
    national = national.substring(1);
  }
  
  // 3. Manejar el "15" según la longitud y posición
  // Caso A: Empieza con 15 y tiene 8 o 9 dígitos (ej: 154123456 -> Neuquén/default 299)
  if (national.startsWith('15') && (national.length === 8 || national.length === 9)) {
    national = '299' + national.substring(2);
  }
  // Caso B: Área de 3 dígitos + 15 (ej: 299 15 1234567) -> longitud 12
  else if (national.length === 12 && national.substring(3, 5) === '15') {
    national = national.substring(0, 3) + national.substring(5);
  }
  // Caso C: Área de 2 dígitos + 15 (ej: 11 15 12345678) -> longitud 12
  else if (national.length === 12 && national.substring(2, 4) === '15') {
    national = national.substring(0, 2) + national.substring(4);
  }
  // Caso D: Área de 4 dígitos + 15 (ej: 2994 15 123456) -> longitud 12
  else if (national.length === 12 && national.substring(4, 6) === '15') {
    national = national.substring(0, 4) + national.substring(6);
  }
  
  // 4. Si el nacional resultante tiene 10 dígitos (estándar), añadir 549
  if (national.length === 10) {
    return '549' + national;
  }
  
  // Si el original ya tiene 549 y tenía longitud correcta de 13 dígitos
  if (digits.startsWith('549') && digits.length === 13) {
    return digits;
  }
  
  // Si el original tiene 10 dígitos (perfecto local)
  if (digits.length === 10) {
    return '549' + digits;
  }
  
  // Si tiene 12 dígitos y empieza con 54 (pero no 549), le inyectamos el 9 celular
  if (digits.startsWith('54') && digits.length === 12 && !digits.startsWith('549')) {
    return '549' + digits.substring(2);
  }

  if (digits.startsWith('549')) {
    return digits;
  }

  if (digits.startsWith('54')) {
    return '549' + digits.substring(2);
  }
  
  // Prefijo fallback para Argentina
  return '549' + digits;
};
