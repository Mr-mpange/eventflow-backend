import { Response, NextFunction } from 'express';
import { GuestService } from '../services/GuestService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';
import { RsvpStatus } from '@prisma/client';

export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const guest = await this.guestService.create(req.user!.sub, req.body);
      res.status(201).json({ success: true, data: guest });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, search, groupId, rsvpStatus } = req.query;
      const result = await this.guestService.list(
        param(req.params.eventId),
        req.user!.sub,
        Number(page) || 1,
        Number(limit) || 50,
        search as string,
        groupId as string,
        rsvpStatus as RsvpStatus,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const guest = await this.guestService.update(param(req.params.id), req.user!.sub, req.body);
      res.json({ success: true, data: guest });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.guestService.delete(param(req.params.id), req.user!.sub);
      res.json({ success: true, message: 'Guest deleted' });
    } catch (error) {
      next(error);
    }
  };

  importCsv = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.guestService.importCsv(param(req.params.eventId), req.user!.sub, req.body.guests);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  exportCsv = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { headers, rows } = await this.guestService.exportCsv(param(req.params.eventId), req.user!.sub);
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="guests-${param(req.params.eventId)}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };

  createGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.guestService.createGroup(req.user!.sub, req.body.eventId, req.body.name, req.body.color);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  };

  listGroups = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const groups = await this.guestService.listGroups(param(req.params.eventId), req.user!.sub);
      res.json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  };
}
