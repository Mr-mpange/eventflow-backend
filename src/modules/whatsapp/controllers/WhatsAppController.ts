import { Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/WhatsAppService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';

export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  sendSingle = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const message = await this.whatsAppService.sendSingle(req.user!.sub, req.body);
      res.status(202).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  };

  sendBulk = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.whatsAppService.sendBulk(req.user!.sub, req.body);
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  scheduleCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const campaign = await this.whatsAppService.scheduleCampaign(req.user!.sub, req.body);
      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };

  getDeliveryTracking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tracking = await this.whatsAppService.getDeliveryTracking(param(req.params.campaignId), req.user!.sub);
      res.json({ success: true, data: tracking });
    } catch (error) {
      next(error);
    }
  };

  getTemplates = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await this.whatsAppService.getTemplates();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  };

  createTemplate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await this.whatsAppService.createTemplate(req.user!.sub, req.body);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  };

  listCampaigns = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const campaigns = await this.whatsAppService.listCampaigns(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  };

  sendInvitation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lang = (req.body?.language === 'sw' ? 'sw' : 'en') as 'en' | 'sw';
      const result = await this.whatsAppService.sendInvitation(param(req.params.guestId), req.user!.sub, lang);
      res.status(202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
