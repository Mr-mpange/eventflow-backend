import QRCode from 'qrcode';
import { TicketStatus } from '@prisma/client';
import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import { generateToken } from '@/shared/utils/helpers';
import { auditService } from '@/shared/services/AuditService';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { CardService } from '@modules/cards/card.service';
import { TicketRepository } from '../repositories/TicketRepository';

export class TicketService {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly cardService: CardService,
  ) {}

  async issueTicket(eventId: string, guestId: string) {
    const [event, guest, existing] = await Promise.all([
      this.eventRepo.findById(eventId),
      this.guestRepo.findById(guestId),
      this.ticketRepo.findByGuest(eventId, guestId),
    ]);

    if (!event) throw new NotFoundError('Event', eventId);
    if (!guest) throw new NotFoundError('Guest', guestId);

    const ticketToken = existing?.ticketToken ?? generateToken(16);
    const qrDataUrl = await QRCode.toDataURL(ticketToken);
    const buffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const upload = await cloudinaryService.uploadImage(buffer, `tickets/${eventId}`, guestId);

    const ticket = existing
      ? await this.ticketRepo.update(existing.id, {
          qrCodeUrl: upload.url,
          status: TicketStatus.ACTIVE,
          issuedAt: existing.issuedAt ?? new Date(),
        })
      : await this.ticketRepo.create({
          event: { connect: { id: eventId } },
          guest: { connect: { id: guestId } },
          ticketToken,
          qrCodeUrl: upload.url,
          issuedAt: new Date(),
        });

    const delivery = await this.cardService.sendTicketCard(eventId, guestId, upload.url);
    await this.ticketRepo.update(ticket.id, { cardUrl: delivery.cardUrl });

    await auditService.log('CREATE', 'Ticket', ticket.id, { userId: event.organizerId }, undefined, {
      eventId,
      guestId,
      deliveryChannel: delivery.channel,
    });

    return {
      ...ticket,
      qrCodeUrl: upload.url,
      cardUrl: delivery.cardUrl,
      deliveryChannel: delivery.channel,
    };
  }

  async verifyToken(ticketToken: string) {
    const ticket = await this.ticketRepo.findByToken(ticketToken);
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.status !== TicketStatus.ACTIVE) throw new ValidationError('Ticket is not active');

    return {
      valid: true,
      ticket,
      guest: {
        id: ticket.guest.id,
        fullName: ticket.guest.fullName,
        checkedInAt: ticket.guest.checkedInAt,
      },
      event: {
        id: ticket.event.id,
        title: ticket.event.title,
        eventDate: ticket.event.eventDate,
      },
    };
  }
}
