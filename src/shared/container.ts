import { UserRepository } from '@modules/auth/repositories/UserRepository';
import { RefreshTokenRepository } from '@modules/auth/repositories/RefreshTokenRepository';
import { PasswordResetRepository } from '@modules/auth/repositories/PasswordResetRepository';
import { EmailVerificationRepository } from '@modules/auth/repositories/EmailVerificationRepository';
import { AuthService } from '@modules/auth/services/AuthService';
import { AuthController } from '@modules/auth/controllers/AuthController';
import { UserService } from '@modules/user/services/UserService';
import { UserController } from '@modules/user/controllers/UserController';
import { OrganizationRepository } from '@modules/user/repositories/OrganizationRepository';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { EventCategoryRepository } from '@modules/event/repositories/EventCategoryRepository';
import { EventService } from '@modules/event/services/EventService';
import { EventController } from '@modules/event/controllers/EventController';
import { InvitationRepository } from '@modules/invitation/repositories/InvitationRepository';
import { InvitationTemplateRepository } from '@modules/invitation/repositories/InvitationTemplateRepository';
import { InvitationService } from '@modules/invitation/services/InvitationService';
import { InvitationController } from '@modules/invitation/controllers/InvitationController';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { GuestGroupRepository } from '@modules/guest/repositories/GuestGroupRepository';
import { GuestService } from '@modules/guest/services/GuestService';
import { GuestController } from '@modules/guest/controllers/GuestController';
import { RsvpRepository } from '@modules/rsvp/repositories/RsvpRepository';
import { RsvpService } from '@modules/rsvp/services/RsvpService';
import { RsvpController } from '@modules/rsvp/controllers/RsvpController';
import { QrService } from '@modules/qr/services/QrService';
import { QrController } from '@modules/qr/controllers/QrController';
import { AttendanceLogRepository } from '@modules/qr/repositories/AttendanceLogRepository';
import { WhatsAppMessageRepository } from '@modules/whatsapp/repositories/WhatsAppMessageRepository';
import { WhatsAppCampaignRepository } from '@modules/whatsapp/repositories/WhatsAppCampaignRepository';
import { WhatsAppTemplateRepository } from '@modules/whatsapp/repositories/WhatsAppTemplateRepository';
import { WhatsAppService } from '@modules/whatsapp/services/WhatsAppService';
import { WhatsAppController } from '@modules/whatsapp/controllers/WhatsAppController';
import { AnalyticsService } from '@modules/analytics/services/AnalyticsService';
import { AnalyticsController } from '@modules/analytics/controllers/AnalyticsController';
import { SubscriptionRepository } from '@modules/subscription/repositories/SubscriptionRepository';
import { InvoiceRepository } from '@modules/subscription/repositories/InvoiceRepository';
import { SubscriptionService } from '@modules/subscription/services/SubscriptionService';
import { SubscriptionController } from '@modules/subscription/controllers/SubscriptionController';

// Repositories
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const passwordResetRepository = new PasswordResetRepository();
const emailVerificationRepository = new EmailVerificationRepository();
const organizationRepository = new OrganizationRepository();
const eventRepository = new EventRepository();
const eventCategoryRepository = new EventCategoryRepository();
const invitationRepository = new InvitationRepository();
const invitationTemplateRepository = new InvitationTemplateRepository();
const guestRepository = new GuestRepository();
const guestGroupRepository = new GuestGroupRepository();
const rsvpRepository = new RsvpRepository();
const attendanceLogRepository = new AttendanceLogRepository();
const whatsAppMessageRepository = new WhatsAppMessageRepository();
const whatsAppCampaignRepository = new WhatsAppCampaignRepository();
const whatsAppTemplateRepository = new WhatsAppTemplateRepository();
const subscriptionRepository = new SubscriptionRepository();
const invoiceRepository = new InvoiceRepository();

// Services
const authService = new AuthService(
  userRepository,
  refreshTokenRepository,
  passwordResetRepository,
  emailVerificationRepository,
);
const userService = new UserService(userRepository, organizationRepository);
const eventService = new EventService(eventRepository, eventCategoryRepository);
const invitationService = new InvitationService(invitationRepository, invitationTemplateRepository, eventRepository);
const guestService = new GuestService(guestRepository, guestGroupRepository, eventRepository);
const rsvpService = new RsvpService(rsvpRepository, guestRepository);
const qrService = new QrService(guestRepository, attendanceLogRepository, eventRepository);
const whatsAppService = new WhatsAppService(
  whatsAppMessageRepository,
  whatsAppCampaignRepository,
  whatsAppTemplateRepository,
  guestRepository,
  eventRepository,
);
const analyticsService = new AnalyticsService(
  eventRepository,
  guestRepository,
  whatsAppMessageRepository,
  attendanceLogRepository,
);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  invoiceRepository,
  organizationRepository,
  userRepository,
);

// Controllers
export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const eventController = new EventController(eventService);
export const invitationController = new InvitationController(invitationService);
export const guestController = new GuestController(guestService);
export const rsvpController = new RsvpController(rsvpService);
export const qrController = new QrController(qrService);
export const whatsAppController = new WhatsAppController(whatsAppService);
export const analyticsController = new AnalyticsController(analyticsService);
export const subscriptionController = new SubscriptionController(subscriptionService);

export {
  authService,
  userService,
  eventService,
  invitationService,
  guestService,
  rsvpService,
  qrService,
  whatsAppService,
  analyticsService,
  subscriptionService,
};
