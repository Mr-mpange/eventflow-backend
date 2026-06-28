import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';
import { PledgeService } from './pledge.service';

export class PledgeController {
  constructor(private readonly pledgeService: PledgeService) {}

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.pledgeService.create(req.user!.sub, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listByEvent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.pledgeService.listByEvent(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.pledgeService.updateStatus(param(req.params.id), req.user!.sub, req.body.status);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
