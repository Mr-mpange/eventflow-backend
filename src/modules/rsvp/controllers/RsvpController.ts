import { Request, Response, NextFunction } from 'express';
import { RsvpService } from '../services/RsvpService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { ForbiddenError } from '@/shared/errors/AppError';

export class RsvpController {
  constructor(
    private readonly rsvpService: RsvpService,
    private readonly eventRepo: EventRepository = new EventRepository(),
  ) {}

  respond = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.rsvpService.respond(req.body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { qrCode, note, plusOnes } = req.body;
      const result = await this.rsvpService.accept(qrCode, note, plusOnes, { ip: req.ip, userAgent: req.headers['user-agent'] });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  decline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { qrCode, note } = req.body;
      const result = await this.rsvpService.decline(qrCode, note, { ip: req.ip, userAgent: req.headers['user-agent'] });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  maybe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { qrCode, note, plusOnes } = req.body;
      const result = await this.rsvpService.maybe(qrCode, note, plusOnes, { ip: req.ip, userAgent: req.headers['user-agent'] });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  analytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventRepo.findById(param(req.params.eventId));
      if (!event || event.organizerId !== req.user!.sub) {
        throw new ForbiddenError();
      }
      const analytics = await this.rsvpService.getAnalytics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  };
}
