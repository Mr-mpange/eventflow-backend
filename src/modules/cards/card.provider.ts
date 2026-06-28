import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import { buildCardSvg, CardTemplateInput } from './card.templates';

export class CardProvider {
  async renderCard(folder: string, filename: string, template: CardTemplateInput) {
    const svg = buildCardSvg(template);
    const buffer = Buffer.from(svg, 'utf8');
    return cloudinaryService.uploadImage(buffer, folder, filename);
  }
}

export const cardProvider = new CardProvider();
