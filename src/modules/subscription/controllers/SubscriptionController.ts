import { Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/SubscriptionService';
import { AuthRequest } from '@/middleware/auth';

export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  getSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.subscriptionService.getSubscription(req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  upgradePlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subscription = await this.subscriptionService.upgradePlan(req.user!.sub, req.body);
      res.json({ success: true, data: subscription });
    } catch (error) {
      next(error);
    }
  };

  getInvoices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoices = await this.subscriptionService.getInvoices(req.user!.sub);
      res.json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  };

  getPlans = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plans = await this.subscriptionService.getPlans();
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  };
}
