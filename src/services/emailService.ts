import nodemailer from 'nodemailer';
import aws from '@aws-sdk/client-ses';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const ses = new aws.SES({
      apiVersion: '2010-12-01',
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
      }
    });

    this.transporter = nodemailer.createTransport({
      SES: { ses, aws }
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: `"Ultra Platform" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}`);
    } catch (error: any) {
      logger.error(`Failed to send email: ${error.message}`);
      throw new Error('Failed to send email');
    }
  }

  async sendOTP(email: string, otp: string, firstName: string): Promise<void> {
    const subject = 'Verify Your Email - Ultra Platform';
    const text = `Hi ${firstName},\n\nYour OTP for email verification is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nUltra Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p>Hi ${firstName},</p>
        <p>Your OTP for email verification is:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666;">This code will expire in 10 minutes.</p>
        <p style="color: #666;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Best regards,<br>Ultra Team</p>
      </div>
    `;

    await this.sendEmail({ to: email, subject, text, html });
  }

  async sendPasswordResetOTP(email: string, otp: string, firstName: string): Promise<void> {
    const subject = 'Reset Your Password - Ultra Platform';
    const text = `Hi ${firstName},\n\nYour OTP for password reset is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this email and your password will remain unchanged.\n\nBest regards,\nUltra Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Hi ${firstName},</p>
        <p>Your OTP for password reset is:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666;">This code will expire in 10 minutes.</p>
        <p style="color: #666;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Best regards,<br>Ultra Team</p>
      </div>
    `;

    await this.sendEmail({ to: email, subject, text, html });
  }
}

export default new EmailService();
