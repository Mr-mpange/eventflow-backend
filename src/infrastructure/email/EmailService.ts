import nodemailer from 'nodemailer';
import { env } from '@/config/env';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  async send(options: EmailOptions): Promise<void> {
    if (!transporter) {
      console.log(`[Email Dev] To: ${options.to}, Subject: ${options.subject}`);
      return;
    }

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Verify your EventFlow account',
      html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
      text: `Verify your email: ${url}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Reset your EventFlow password',
      html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      text: `Reset password: ${url}`,
    });
  }
}

export const emailService = new EmailService();
