import nodemailer from "nodemailer"

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "mail.purelymail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER ?? "knowledgeos@parrytech.co",
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.FROM_EMAIL ?? "knowledgeos@parrytech.co"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://knowledgeos.parrytech.co"

export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string
  name?: string | null
  token: string
}) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`
  await getTransport().sendMail({
    from: `"KnowledgeOS" <${FROM}>`,
    to: email,
    subject: "Verify your KnowledgeOS account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111827;color:#f3f4f6;border-radius:12px">
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">KnowledgeOS</h1>
        <p style="color:#9ca3af;margin:0 0 24px;font-size:14px">The knowledge base that builds itself</p>
        <p style="font-size:15px;margin:0 0 8px">Hi${name ? ` ${name}` : ""},</p>
        <p style="font-size:14px;color:#d1d5db;margin:0 0 24px">
          Verify your email address to activate your free KnowledgeOS account and start using your own local vault.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Verify email address
        </a>
        <p style="font-size:12px;color:#6b7280;margin:24px 0 0">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail({
  email,
  token,
}: {
  email: string
  token: string
}) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`
  await getTransport().sendMail({
    from: `"KnowledgeOS" <${FROM}>`,
    to: email,
    subject: "Reset your KnowledgeOS password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111827;color:#f3f4f6;border-radius:12px">
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">KnowledgeOS</h1>
        <p style="color:#9ca3af;margin:0 0 24px;font-size:14px">Password reset request</p>
        <p style="font-size:14px;color:#d1d5db;margin:0 0 24px">
          Click the button below to reset your password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Reset password
        </a>
        <p style="font-size:12px;color:#6b7280;margin:24px 0 0">
          If you didn't request a password reset, you can ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendWelcomeEmail({
  email,
  name,
}: {
  email: string
  name?: string | null
}) {
  await getTransport().sendMail({
    from: `"KnowledgeOS" <${FROM}>`,
    to: email,
    subject: "Welcome to KnowledgeOS",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#111827;color:#f3f4f6;border-radius:12px">
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px">KnowledgeOS</h1>
        <p style="font-size:15px;margin:0 0 8px">Welcome${name ? `, ${name}` : ""}!</p>
        <p style="font-size:14px;color:#d1d5db;margin:0 0 24px">
          Your email is verified. You can now connect your own local vault folder and start building your knowledge base.
        </p>
        <a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Open KnowledgeOS
        </a>
        <p style="font-size:12px;color:#6b7280;margin:24px 0 0">
          On the free plan, KnowledgeOS uses your own API key (OpenAI or Anthropic). Upgrade anytime for managed AI with no key required.
        </p>
      </div>
    `,
  })
}
