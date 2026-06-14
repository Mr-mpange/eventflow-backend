import { Response, NextFunction } from 'express';
import multer from 'multer';
import { EventService } from '../services/EventService';
import { AuthRequest } from '@/middleware/auth';
import { param } from '@/shared/utils/params';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export class EventController {
  constructor(private readonly eventService: EventService) {}

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.create(req.user!.sub, req.body);
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, status } = req.query as { page?: string; limit?: string; status?: string };
      const result = await this.eventService.list(
        req.user!.sub,
        Number(page) || 1,
        Number(limit) || 20,
        status as Parameters<EventService['list']>[3],
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.findById(param(req.params.id), req.user!.sub);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.update(param(req.params.id), req.user!.sub, req.body);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.eventService.delete(param(req.params.id), req.user!.sub);
      res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
      next(error);
    }
  };

  uploadCover = [
    upload.single('cover'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
          return;
        }
        const event = await this.eventService.uploadCover(param(req.params.id), req.user!.sub, req.file.buffer);
        res.json({ success: true, data: event });
      } catch (error) {
        next(error);
      }
    },
  ];

  getCategories = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.eventService.getCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.eventService.getSettings(param(req.params.id), req.user!.sub);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.eventService.updateSettings(param(req.params.id), req.user!.sub, req.body);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };
}
