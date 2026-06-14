import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventFlow API',
      version: '1.0.0',
      description: 'Wedding & Event Invitation Management Platform API',
      contact: { name: 'EventFlow Support', email: 'support@eventflow.app' },
    },
    servers: [{ url: `${env.APP_URL}/api/${env.API_VERSION}`, description: 'API Server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EVENT_ORGANIZER', 'STAFF'] },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            eventDate: { type: 'string', format: 'date-time' },
            venue: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Events', description: 'Event management' },
      { name: 'Invitations', description: 'Invitation design' },
      { name: 'Guests', description: 'Guest list management' },
      { name: 'RSVP', description: 'RSVP responses' },
      { name: 'QR', description: 'QR code & check-in' },
      { name: 'WhatsApp', description: 'WhatsApp messaging' },
      { name: 'Analytics', description: 'Event analytics' },
      { name: 'Subscriptions', description: 'Billing & plans' },
    ],
  },
  apis: ['./src/modules/**/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
