import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';
import { ContributionService } from './contribution.service';

export class ContributionController {
  constructor(private readonly contributionService: ContributionService) {}

  listByEvent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.contributionService.listByEvent(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getBalance = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.contributionService.getBalance(param(req.params.eventId), param(req.params.guestId));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.contributionService.updateContribution(
        param(req.params.eventId),
        param(req.params.guestId),
        req.user!.sub,
        req.body,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
