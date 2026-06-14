import { Response, NextFunction } from 'express';
import { QrService } from '../services/QrService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';

export class QrController {
  constructor(private readonly qrService: QrService) {}

  generate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.qrService.generate(param(req.params.guestId), req.user!.sub);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.qrService.verify(param(req.params.qrCode));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  checkIn = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const log = await this.qrService.checkIn(req.body.qrCode, req.user!.sub, req.body.notes);
      res.json({ success: true, data: log });
    } catch (error) {
      next(error);
    }
  };

  attendanceLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.qrService.getAttendanceLogs(
        param(req.params.eventId),
        req.user!.sub,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 50,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
