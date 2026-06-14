import { Router } from 'express';
import { whatsAppController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import {
  sendMessageSchema,
  bulkMessageSchema,
  scheduleCampaignSchema,
  createTemplateSchema,
} from '../validators/whatsapp.validator';

const router = Router();

router.use(authenticate);

router.post('/send', validate(sendMessageSchema), whatsAppController.sendSingle);
router.post('/bulk', validate(bulkMessageSchema), whatsAppController.sendBulk);
router.post('/campaigns/schedule', validate(scheduleCampaignSchema), whatsAppController.scheduleCampaign);
router.get('/campaigns/:campaignId/tracking', whatsAppController.getDeliveryTracking);
router.get('/campaigns/event/:eventId', whatsAppController.listCampaigns);
router.get('/templates', whatsAppController.getTemplates);
router.post('/templates', validate(createTemplateSchema), whatsAppController.createTemplate);

export default router;
