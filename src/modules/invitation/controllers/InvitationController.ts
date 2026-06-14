import { Response, NextFunction } from 'express';
import { InvitationService } from '../services/InvitationService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';

export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  getTemplates = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await this.invitationService.getTemplates();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitation = await this.invitationService.create(req.user!.sub, req.body);
      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  };

  listByEvent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitations = await this.invitationService.findByEvent(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitation = await this.invitationService.findById(param(req.params.id), req.user!.sub);
      res.json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitation = await this.invitationService.update(param(req.params.id), req.user!.sub, req.body);
      res.json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  };

  preview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const preview = await this.invitationService.preview(param(req.params.id), req.user!.sub);
      res.json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  };

  publish = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invitation = await this.invitationService.publish(param(req.params.id), req.user!.sub);
      res.json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.invitationService.delete(param(req.params.id), req.user!.sub);
      res.json({ success: true, message: 'Invitation deleted' });
    } catch (error) {
      next(error);
    }
  };
}
