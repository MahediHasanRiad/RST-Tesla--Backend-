import { env } from "../../config/env.js";

export type OtpMail = {
  email: string;
  otp: string;
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
};

export async function sendOtpMail(mail: OtpMail) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL)
    throw new Error("Brevo email delivery is not configured");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: mail.email }],
      subject: "Your Dhaka Tesla Pool code",
      textContent: `Your ${mail.purpose === "PASSWORD_RESET" ? "password reset" : "email verification"} code is ${mail.otp}. It expires soon.`,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Brevo delivery failed: HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
}
