// Dev-only mailer. No real email provider is configured yet -- this just logs
// what would be sent so the flow can be built and tested end-to-end.
// Swap the inside of sendEmail() for a real provider (e.g. Microsoft 365 / Outlook)
// later without changing any code that calls it.

type EmailInput = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail({ to, subject, body }: EmailInput): Promise<void> {
  console.log("\n===== DEV EMAIL (not actually sent) =====");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(body);
  console.log("===========================================\n");
}
