/**
 * Plan-based notification limits per billing period.
 * 
 * These are placeholder limits — real Stripe-driven limits
 * will replace this in a future task.
 */
export const PLAN_LIMITS: Record<string, { EMAIL: number; SMS: number }> = {
  FREE:    { EMAIL: 1000,   SMS: 100 },
  STARTER: { EMAIL: 10000,  SMS: 1000 },
  GROWTH:  { EMAIL: 50000,  SMS: 5000 },
  SCALE:   { EMAIL: 200000, SMS: 20000 },
};
