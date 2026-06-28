import { env } from '@/config/env';
import { briqSmsService } from '@/infrastructure/sms/BriqSmsService';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { cardProvider } from './card.provider';
import { CardType } from './card.templates';
import { NotFoundError, ValidationError } from '@/shared/errors/AppError';

export interface CardSendResult {
  cardUrl: string;
  channel: 'whatsapp' | 'sms';
  reference: string;
}

export class CardService {
  constructor(
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
  ) {}

  private async buildBaseCard(type: CardType, eventId: string, guestId: string, extras: {
    subtitle: string;
    amount?: string;
    linkLabel?: string;
    linkValue?: string;
    footer?: string;
  }) {
    const [event, guest] = await Promise.all([
      this.eventRepo.findById(eventId),
      this.guestRepo.findById(guestId),
    ]);

    if (!event) throw new NotFoundError('Event', eventId);
    if (!guest) throw new NotFoundError('Guest', guestId);

    const eventDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(event.eventDate));

    const uploaded = await cardProvider.renderCard(
      `cards/${eventId}`,
      `${type.toLowerCase()}-${guestId}`,
      {
        type,
        title: event.title,
        subtitle: extras.subtitle,
        guestName: guest.fullName,
        eventName: event.title,
        eventDate,
        venue: event.venue ?? 'TBA',
        amount: extras.amount,
        linkLabel: extras.linkLabel,
        linkValue: extras.linkValue,
        footer: extras.footer,
      },
    );

    return { event, guest, cardUrl: uploaded.url };
  }

  private async deliverCard(phone: string | null | undefined, message: string): Promise<{ channel: 'whatsapp' | 'sms'; reference: string; }> {
    if (!phone) throw new ValidationError('Guest has no phone number');

    const wa = await ghalaRailsService.sendMessage({ to: phone, message });
    if (wa.status !== 'failed') {
      return { channel: 'whatsapp', reference: wa.externalId };
    }

    const sms = await briqSmsService.sendMessage({ to: phone, message });
    return { channel: 'sms', reference: sms.externalId };
  }

  async sendInvitationCard(eventId: string, guestId: string, contributionAmount?: number): Promise<CardSendResult> {
    const payLink = `${env.APP_PUBLIC_URL}/pay/${eventId}/${guestId}`;
    const { guest, cardUrl } = await this.buildBaseCard('INVITATION_CARD', eventId, guestId, {
      subtitle: 'Invitation Card',
      amount: contributionAmount ? `TZS ${contributionAmount.toLocaleString()}` : undefined,
      linkLabel: 'Pay / RSVP',
      linkValue: payLink,
      footer: cardUrlFallbackText(cardUrlPlaceholder(payLink)),
    });

    const delivery = await this.deliverCard(
      guest.phone,
      `Your invitation card is ready.\nCard: ${cardUrl}\nRSVP / Payment: ${payLink}`,
    );

    return { cardUrl, ...delivery };
  }

  async sendPaymentConfirmationCard(eventId: string, guestId: string, amountPaid: number, remainingAmount: number): Promise<CardSendResult> {
    const { guest, cardUrl } = await this.buildBaseCard('PAYMENT_CONFIRMATION_CARD', eventId, guestId, {
      subtitle: 'Payment Confirmation',
      amount: `Paid TZS ${amountPaid.toLocaleString()} | Remaining TZS ${remainingAmount.toLocaleString()}`,
      footer: remainingAmount > 0 ? 'Thank you. Complete the balance to receive your QR ticket.' : 'Contribution complete.',
    });

    const delivery = await this.deliverCard(
      guest.phone,
      `Malipo yamepokelewa.\nReceipt card: ${cardUrl}\nRemaining balance: TZS ${remainingAmount.toLocaleString()}`,
    );

    return { cardUrl, ...delivery };
  }

  async sendTicketCard(eventId: string, guestId: string, ticketUrl: string): Promise<CardSendResult> {
    const { guest, cardUrl } = await this.buildBaseCard('QR_TICKET_CARD', eventId, guestId, {
      subtitle: 'QR Ticket',
      linkLabel: 'Ticket',
      linkValue: ticketUrl,
      footer: 'Present this ticket at the entrance.',
    });

    const delivery = await this.deliverCard(
      guest.phone,
      `Your QR ticket is ready.\nTicket card: ${cardUrl}\nTicket: ${ticketUrl}`,
    );

    return { cardUrl, ...delivery };
  }
}

function cardUrlPlaceholder(value: string) {
  return value;
}

function cardUrlFallbackText(value: string) {
  return `Link: ${value}`;
}
