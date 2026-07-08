import forge from 'node-forge';
import fs from 'fs';

console.log('--- GENERADOR DE CERTIFICADOS PARA AFIP (HOMOLOGACION) ---');
console.log('Generando Clave Privada (RSA 2048 bits)... Esto puede tomar unos segundos.');

// Generar par de claves RSA
const keys = forge.pki.rsa.generateKeyPair(2048);
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

// Guardar Clave Privada
fs.writeFileSync('afip_privada.key', privateKeyPem);
console.log('✅ Clave privada guardada en: afip_privada.key');

console.log('Generando Solicitud de Certificado (CSR)...');
// Crear CSR
const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;

// Configurar sujeto (Cambiar el CUIT por el CUIT real del usuario para homologación)
// Para homologación, el CUIT que pongas aquí debe coincidir con el CUIT de la persona que entra a AFIP
const CUIT = '20346582201'; // <--- EL USUARIO DEBE CAMBIAR ESTO
const EMPRESA = 'Mi Empresa de Prueba';

csr.setSubject([
  {
    shortName: 'CN',
    value: EMPRESA
  },
  {
    shortName: 'O',
    value: EMPRESA
  },
  {
    shortName: 'C',
    value: 'AR'
  },
  {
    name: 'serialNumber',
    value: `CUIT ${CUIT}`
  }
]);

// Firmar CSR con la clave privada
csr.sign(keys.privateKey);

// Convertir a PEM
const pem = forge.pki.certificationRequestToPem(csr);

// Guardar CSR
fs.writeFileSync('afip_solicitud.csr', pem);
console.log('✅ Solicitud de certificado (CSR) guardada en: afip_solicitud.csr');
console.log('');
console.log('PASOS SIGUIENTES:');
console.log('1. Entra a la página de AFIP (afip.gob.ar) con tu CUIT y Clave Fiscal.');
console.log('2. Busca el servicio "WSASS - Autogestión Certificados Homologación".');
console.log('   (Si no lo tienes, debes agregarlo desde "Administrador de Relaciones de Clave Fiscal").');
console.log('3. Dentro del servicio WSASS, haz clic en "Nuevo Certificado".');
console.log('4. Ponle un nombre (ej: "Testing_Nextjs") y sube el archivo "afip_solicitud.csr" que se acaba de crear.');
console.log('5. Haz clic en descargar el certificado (se descargará un archivo .crt).');
console.log('6. ¡Listo! Ya tienes la clave privada (.key) y el certificado (.crt).');
