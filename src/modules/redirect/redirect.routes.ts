/**
 * Redirect routes — stable backend URLs used as WhatsApp template button base URLs.
 *
 * WhatsApp templates require a STATIC base domain baked in at approval time.
 * By pointing templates at these backend routes, the actual frontend destination
 * can be changed any time via FRONTEND_URL in .env — no template re-registration needed.
 *
 * Register your WhatsApp templates with these base URLs:
 *   RSVP button  → {APP_URL}/go/rsvp/
 *   QR button    → {APP_URL}/go/qr/
 *   Accept link  → {APP_URL}/go/accept/
 *
 * Example: APP_URL = https://api.myapp.com
 *   Template base: https://api.myapp.com/go/rsvp/
 *   Suffix sent:   guest-uuid-here
 *   Guest taps:    https://api.myapp.com/go/rsvp/guest-uuid-here
 *   Redirected to: https://yourfrontend.com/rsvp/guest-uuid-here  ← FRONTEND_URL
 *
 * No auth required — these are public redirect links sent to guests.
 */
import { Router, Request, Response } from 'express';
import { env } from '@/config/env';

const router = Router();

/**
 * @swagger
 * /go/rsvp/{token}:
 *   get:
 *     tags: [Redirects]
 *     summary: Redirect to frontend RSVP page
 *     description: |
 *       Stable redirect used as the WhatsApp template RSVP button base URL.
 *       Redirects to `{FRONTEND_URL}/rsvp/{token}`.
 *       Change `FRONTEND_URL` in .env to update the destination without touching the template.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Guest UUID
 *     responses:
 *       302:
 *         description: Redirect to frontend RSVP page
 */
router.get('/rsvp/:token', (req: Request, res: Response) => {
  const dest = `${env.FRONTEND_URL}/rsvp/${encodeURIComponent(req.params['token'] as string)}`;
  res.redirect(302, dest);
});

/**
 * @swagger
 * /go/qr/{token}:
 *   get:
 *     tags: [Redirects]
 *     summary: Redirect to frontend QR page
 *     description: |
 *       Stable redirect used as the WhatsApp template QR button base URL.
 *       Redirects to `{FRONTEND_URL}/qr/{token}`.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Guest QR code UUID
 *     responses:
 *       302:
 *         description: Redirect to frontend QR page
 */
router.get('/qr/:token', (req: Request, res: Response) => {
  const dest = `${env.FRONTEND_URL}/qr/${encodeURIComponent(req.params['token'] as string)}`;
  res.redirect(302, dest);
});

/**
 * @swagger
 * /go/accept/{token}:
 *   get:
 *     tags: [Redirects]
 *     summary: Redirect to frontend accept invitation page
 *     description: |
 *       Stable redirect for the accept invitation link.
 *       Redirects to `{FRONTEND_URL}/accept/{token}`.
 *       The frontend page should call `POST /api/v1/rsvp/accept` with `{ qrCode: token }`.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Guest QR code UUID
 *     responses:
 *       302:
 *         description: Redirect to frontend accept page
 */
router.get('/accept/:token', (req: Request, res: Response) => {
  const dest = `${env.FRONTEND_URL}/accept/${encodeURIComponent(req.params['token'] as string)}`;
  res.redirect(302, dest);
});

export default router;
