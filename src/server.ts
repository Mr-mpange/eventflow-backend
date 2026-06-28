import 'dotenv/config';
import { createApp } from './app';
import { env } from '@/config/env';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import { connectRedis, disconnectRedis } from '@/config/redis';
import { createWhatsAppWorker } from '@/jobs/whatsapp.processor';
import { createAutomationWorker } from '@/jobs/automation.processor';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const app = createApp();

  // Start the WhatsApp message queue worker
  const whatsappWorker = createWhatsAppWorker();
  const automationWorker = createAutomationWorker();
  console.log('[Worker] WhatsApp message processor started');
  console.log('[Worker] Automation processor started');

  const server = app.listen(env.PORT, () => {
    console.log(`EventFlow API running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`Swagger docs: ${env.APP_URL}/api-docs`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    await whatsappWorker.close();
    await automationWorker.close();
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
