import { Router } from 'express';
import { analyticsController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/event/:eventId', analyticsController.eventAnalytics);
router.get('/rsvp/:eventId', analyticsController.rsvpStats);
router.get('/attendance/:eventId', analyticsController.attendanceStats);
router.get('/messages/:eventId', analyticsController.messageStats);

export default router;
