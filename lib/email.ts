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
  const useResendSmtp = !!process.env.RESEND_API_KEY;
  const host = process.env.SMTP_HOST || (useResendSmtp ? "smtp.resend.com" : "smtp.gmail.com");
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = (process.env.SMTP_SECURE ?? "true") === "true";

  // If a Resend API key is present prefer the Resend SMTP credentials
  // (user: "api", pass: RESEND_API_KEY). Do NOT allow stray SMTP_USER/PASS
  // to accidentally override the Resend credentials.
  const user = useResendSmtp ? "api" : process.env.SMTP_USER;
  const pass = useResendSmtp ? process.env.RESEND_API_KEY : process.env.SMTP_PASS;
  const from = process.env.QUOTE_FROM_EMAIL || "Changing Keys <bookings@changingkeys.co.uk>";

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    useResendSmtp,
  };
}

export function getSmtpEnvStatus() {
  const hasResendApiKey = !!process.env.RESEND_API_KEY;
  const hasSmtpUser = !!process.env.SMTP_USER || hasResendApiKey;
  const hasSmtpPass = !!process.env.SMTP_PASS || hasResendApiKey;

  return {
    hasSmtpHost: !!process.env.SMTP_HOST || hasResendApiKey,
    hasSmtpPort: !!process.env.SMTP_PORT || hasResendApiKey,
    hasSmtpSecure: !!process.env.SMTP_SECURE || hasResendApiKey,
    hasSmtpUser,
    hasSmtpPass,
    hasResendApiKey,
    hasQuoteFromEmail: !!process.env.QUOTE_FROM_EMAIL,
    quoteFromEmail: process.env.QUOTE_FROM_EMAIL || "Changing Keys <bookings@changingkeys.co.uk>",
    smtpProvider: process.env.SMTP_HOST ? "custom" : hasResendApiKey ? "resend" : "gmail_default",
  };
}

export function createSmtpTransporter() {
  const config = getSmtpConfig();

  if (!config.user || !config.pass) {
    const status = getSmtpEnvStatus();
    console.log("SMTP CONFIG MISSING - ENV STATUS:", status);
    throw new Error(
      "Missing SMTP email configuration. Required: SMTP_USER and SMTP_PASS, or RESEND_API_KEY for Resend SMTP."
    );
  }

  // Log non-sensitive SMTP config used for troubleshooting (do not log passwords)
  console.log("USING SMTP CONFIG:", {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    useResendSmtp: config.useResendSmtp,
    hasPass: !!config.pass,
  });

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
