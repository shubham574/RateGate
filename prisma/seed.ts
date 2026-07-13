import { PrismaClient, Plan, RateLimitScope, RateLimitStrategy, Channel } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createHash, randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed Script
 * 
 * Creates a test tenant with an API key and default rate limit rules.
 * The raw API key is printed ONCE — it cannot be retrieved after this.
 */
async function seed() {
  console.log('🌱 Seeding database...\n');

  // 1. Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { email: 'test@rategate.dev' },
    update: {},
    create: {
      name: 'Test Tenant',
      email: 'test@rategate.dev',
      plan: Plan.STARTER,
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Generate and store API key
  const rawKey = `rg_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);

  // Check if we already have a key for this tenant
  const existingKey = await prisma.apiKey.findFirst({
    where: { tenantId: tenant.id, revoked: false },
  });

  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        tenantId: tenant.id,
        keyHash,
        keyPrefix,
        label: 'Default API Key',
      },
    });

    console.log(`✓ API Key created`);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  🔑 YOUR API KEY (shown ONCE, save it now!):`);
    console.log(`  ${rawKey}`);
    console.log(`${'═'.repeat(60)}\n`);
  } else {
    console.log(`✓ API Key already exists (prefix: ${existingKey.keyPrefix}...)`);
  }

  // 3. Create default rate limit rules
  const rules = [
    {
      scope: RateLimitScope.API_KEY,
      channel: null,
      windowSecs: 60,
      maxRequests: 100,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    },
    {
      scope: RateLimitScope.RECIPIENT,
      channel: Channel.EMAIL,
      windowSecs: 3600,
      maxRequests: 10,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    },
    {
      scope: RateLimitScope.RECIPIENT,
      channel: Channel.SMS,
      windowSecs: 3600,
      maxRequests: 5,
      strategy: RateLimitStrategy.SLIDING_WINDOW,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.rateLimitRule.findFirst({
      where: {
        tenantId: tenant.id,
        scope: rule.scope,
        channel: rule.channel,
      },
    });

    if (!existing) {
      await prisma.rateLimitRule.create({
        data: {
          tenantId: tenant.id,
          ...rule,
        },
      });
      console.log(
        `✓ Rate limit rule: ${rule.scope} ${rule.channel || 'ALL'} → ${rule.maxRequests}/${rule.windowSecs}s`
      );
    }
  }

  // 4. Create sample email template
  await prisma.template.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'welcome' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'welcome',
      channel: Channel.EMAIL,
      subject: 'Welcome to {{appName}}, {{name}}!',
      body: '<h1>Hello {{name}}!</h1><p>Welcome to {{appName}}. We\'re glad to have you.</p>',
    },
  });
  console.log(`✓ Template: welcome (EMAIL)`);

  await prisma.template.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'verification-code' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'verification-code',
      channel: Channel.SMS,
      body: 'Your {{appName}} verification code is: {{code}}. Expires in 10 minutes.',
    },
  });
  console.log(`✓ Template: verification-code (SMS)`);

  console.log('\n✅ Seed complete!');
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
