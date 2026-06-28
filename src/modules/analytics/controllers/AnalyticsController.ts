import { Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  eventAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getEventAnalytics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  rsvpStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getRsvpStatistics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  attendanceStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getAttendanceStatistics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  messageStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getMessageStatistics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  paymentAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.analyticsService.getPaymentAnalytics(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
