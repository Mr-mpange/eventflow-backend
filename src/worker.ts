import 'dotenv/config';
import { createWhatsAppWorker } from '@/jobs/whatsapp.processor';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const worker = createWhatsAppWorker();

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  console.log('WhatsApp worker started');

  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
