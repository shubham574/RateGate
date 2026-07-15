import app from './app';
import { env } from './config/env';
import { execSync } from 'child_process';

try {
  console.log('[RateGate] Programmatically pushing database schema...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log('[RateGate] Database schema push complete!');
} catch (error) {
  console.error('[RateGate] Failed to push schema:', error);
}

app.listen(env.PORT, () => {
  console.log(`[RateGate] API server running on port ${env.PORT}`);
  console.log(`[RateGate] Environment: ${env.NODE_ENV}`);
  
  // Debug DB connection
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocalDB = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  console.log(`[RateGate DB Check] URL Length: ${dbUrl.length}. Is Localhost? ${isLocalDB ? 'YES (BAD!)' : 'NO (GOOD)'}`);
  
  const redisUrl = process.env.REDIS_URL || '';
  const isLocalRedis = redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');
  console.log(`[RateGate Redis Check] URL Length: ${redisUrl.length}. Is Localhost? ${isLocalRedis ? 'YES (BAD!)' : 'NO (GOOD)'}`);


});
