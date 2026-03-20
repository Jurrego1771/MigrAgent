import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  mediastream: {
    apiUrl: process.env.MEDIASTREAM_API_URL || 'https://platform.mediastre.am',
    // Legacy: solo usados si no hay AuthSession activa en la BD
    apiToken: process.env.MEDIASTREAM_API_TOKEN || '',
    sessionCookie: process.env.MEDIASTREAM_SESSION_COOKIE || '',
    accountId: process.env.MEDIASTREAM_ACCOUNT_ID || '',
  },

  // Clave para cifrado AES-256-GCM de credenciales en BD.
  // Debe ser exactamente 64 caracteres hexadecimales (32 bytes).
  // En producción, siempre establecer SESSION_ENCRYPTION_KEY en el entorno.
  sessionEncryptionKey:
    process.env.SESSION_ENCRYPTION_KEY ||
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',

  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  validation: {
    urlCheckTimeout: 10000, // 10 segundos
    urlCheckConcurrency: 5, // URLs a verificar en paralelo
    maxSampleSize: 100, // Filas máximas para preview
  },

  retry: {
    defaultMaxRetries: 3,
    defaultInitialDelay: 60000, // 1 minuto
    defaultMaxDelay: 3600000, // 1 hora
  },

  alerts: {
    stalledThreshold: 900000, // 15 minutos sin progreso
    errorThresholdPercent: 10, // Alerta si más del 10% son errores
  },
};

export type Config = typeof config;
