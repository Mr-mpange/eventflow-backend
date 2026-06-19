import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';
import { swaggerSpec } from '@/config/swagger';
import { globalRateLimiter } from '@/middleware/rateLimiter';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

import authRoutes from '@modules/auth/routes/auth.routes';
import userRoutes from '@modules/user/routes/user.routes';
import eventRoutes from '@modules/event/routes/event.routes';
import invitationRoutes from '@modules/invitation/routes/invitation.routes';
import guestRoutes from '@modules/guest/routes/guest.routes';
import rsvpRoutes from '@modules/rsvp/routes/rsvp.routes';
import qrRoutes from '@modules/qr/routes/qr.routes';
import whatsappRoutes from '@modules/whatsapp/routes/whatsapp.routes';
import whatsappWebhookRoutes from '@modules/whatsapp/routes/webhook.routes';
import whatsappExternalRoutes from '@modules/whatsapp/routes/external.routes';
import apiKeyRoutes from '@/modules/apikey/apikey.routes';
import analyticsRoutes from '@modules/analytics/routes/analytics.routes';
import subscriptionRoutes from '@modules/subscription/routes/subscription.routes';
import redirectRoutes from '@modules/redirect/redirect.routes';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  }));

  // Tight CORS for browser/frontend routes
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  }));

  // Open CORS for external API (X-API-Key authenticated, called by third-party servers)
  app.use(`/api/${env.API_VERSION}/external`, cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'ngrok-skip-browser-warning'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: env.API_VERSION });
  });

  // Stable redirect routes — used as WhatsApp template button base URLs.
  // No auth, no CORS restriction — these are public links sent to guests.
  // Change FRONTEND_URL in .env to update the destination without re-registering templates.
  app.use('/go', redirectRoutes);

  // GhalaRails webhook receiver — must be before JSON body parser for raw access
  // No auth middleware: GhalaRails/Meta hits this directly
  app.use('/webhook/whatsapp', whatsappWebhookRoutes);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/events', eventRoutes);
  apiRouter.use('/invitations', invitationRoutes);
  apiRouter.use('/guests', guestRoutes);
  apiRouter.use('/rsvp', rsvpRoutes);
  apiRouter.use('/qr', qrRoutes);
  apiRouter.use('/whatsapp', whatsappRoutes);
  apiRouter.use('/analytics', analyticsRoutes);
  apiRouter.use('/subscriptions', subscriptionRoutes);
  apiRouter.use('/api-keys', apiKeyRoutes);

  // External developer API — authenticated via X-API-Key header
  apiRouter.use('/external/whatsapp', whatsappExternalRoutes);

  app.use(`/api/${env.API_VERSION}`, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
