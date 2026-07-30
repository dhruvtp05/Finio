import nodemailer from "nodemailer";
import { WeeklyDigest } from "../utils/insights";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendWeeklyDigestEmail(to: string, digest: WeeklyDigest) {
  if (!smtpConfigured()) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_FROM).");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const highlights = digest.highlights.map((h) => `• ${h}`).join("\n");
  const merchants = digest.topMerchants.map((m) => `  - ${m.name}: $${m.total.toFixed(2)}`).join("\n");

  const text = `Finio weekly digest (${digest.weekLabel})

Spent: $${digest.thisWeek.spent.toFixed(2)} (vs last week ${digest.spentDelta >= 0 ? "+" : ""}$${digest.spentDelta.toFixed(2)})
Income: $${digest.thisWeek.income.toFixed(2)}
Net: $${digest.thisWeek.net.toFixed(2)}

Highlights:
${highlights}

Top merchants:
${merchants || "  (none)"}
`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Finio weekly digest — ${digest.weekLabel}`,
    text,
  });
}
