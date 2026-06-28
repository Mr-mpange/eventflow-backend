import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';
import { PaymentService } from './payment.service';

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.paymentService.createPaymentRequest(req.user!.sub, req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.paymentService.getStatus(param(req.params.id), req.user?.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listByEvent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.paymentService.listByEvent(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.paymentService.handleWebhook(
        req.body,
        req.headers['x-snippe-signature'] as string | undefined,
        (req as Request & { rawBody?: string }).rawBody,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
