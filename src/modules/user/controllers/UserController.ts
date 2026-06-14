import { Response, NextFunction } from 'express';
import multer from 'multer';
import { UserService } from '../services/UserService';
import { AuthRequest } from '@/middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export class UserController {
  constructor(private readonly userService: UserService) {}

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateProfile(req.user!.sub, req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  uploadAvatar = [
    upload.single('avatar'),
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
          return;
        }
        const result = await this.userService.uploadAvatar(req.user!.sub, req.file.buffer);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  ];

  changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.changePassword(req.user!.sub, req.body);
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  };

  getOrganization = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await this.userService.getOrganization(req.user!.sub);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  };

  createOrganization = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await this.userService.createOrganization(req.user!.sub, req.body.name);
      res.status(201).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  };

  updateOrganization = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const org = await this.userService.updateOrganization(req.user!.sub, req.body);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  };
}
