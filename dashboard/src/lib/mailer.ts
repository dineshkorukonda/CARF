import nodemailer from "nodemailer";
import { env } from "../config/env";

export interface SendMailFn {
  (message: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost(),
      port: env.smtpPort(),
      secure: env.smtpPort() === 465,
      auth: { user: env.smtpUser(), pass: env.smtpPassword() },
    });
  }
  return transporter;
}

/** Default `SendMailFn` backed by the real SMTP transport; tests inject a fake instead. */
const sendViaSmtp: SendMailFn = async (message) => {
  await getTransporter().sendMail({ from: env.smtpFrom(), ...message });
};

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  sendMail: SendMailFn = sendViaSmtp
): Promise<void> {
  await sendMail({
    to,
    subject: "Reset your CARF password",
    text: `Reset your CARF dashboard password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your CARF dashboard password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}
