import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env';
import { Readable } from 'stream';

if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

export class CloudinaryService {
  async uploadImage(
    buffer: Buffer,
    folder: string,
    filename?: string,
  ): Promise<UploadResult> {
    if (!env.CLOUDINARY_CLOUD_NAME) {
      return {
        url: `https://placeholder.eventflow.app/${folder}/${filename ?? 'image'}`,
        publicId: `${folder}/${filename ?? Date.now()}`,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `eventflow/${folder}`, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Upload failed'));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (env.CLOUDINARY_CLOUD_NAME) {
      await cloudinary.uploader.destroy(publicId);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
