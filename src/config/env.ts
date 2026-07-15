import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || (() => { if(process.env.NODE_ENV === 'production') throw new Error('REDIS_URL is missing!'); return 'redis://localhost:6379'; })(),
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '+1234567890',
} as const;
