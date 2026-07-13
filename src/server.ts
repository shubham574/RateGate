import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`[RateGate] API server running on port ${env.PORT}`);
  console.log(`[RateGate] Environment: ${env.NODE_ENV}`);
});
