import nodemailer from "nodemailer";

export function getEmailErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export function isSmtpSendSuccessful(result: nodemailer.SentMessageInfo) {
  const accepted = Array.isArray(result.accepted) ? result.accepted : [];
  const rejected = Array.isArray(result.rejected) ? result.rejected : [];

  return accepted.length > 0 && rejected.length === 0;
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = (process.env.SMTP_SECURE || "true") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.QUOTE_FROM_EMAIL || "Changing Keys <bookings@changingkeys.co.uk>";

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

export function getSmtpEnvStatus() {
  return {
    hasSmtpHost: !!process.env.SMTP_HOST,
    hasSmtpPort: !!process.env.SMTP_PORT,
    hasSmtpSecure: !!process.env.SMTP_SECURE,
    hasSmtpUser: !!process.env.SMTP_USER,
    hasSmtpPass: !!process.env.SMTP_PASS,
    hasQuoteFromEmail: !!process.env.QUOTE_FROM_EMAIL,
    quoteFromEmail: process.env.QUOTE_FROM_EMAIL || "Changing Keys <bookings@changingkeys.co.uk>",
  };
}

export function createSmtpTransporter() {
  const config = getSmtpConfig();

  if (!config.user || !config.pass) {
    throw new Error(
      "Missing SMTP email configuration. Required: SMTP_USER and SMTP_PASS."
    );
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}
