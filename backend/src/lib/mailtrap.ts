import { MailtrapClient } from "mailtrap";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const selectionResultTemplate = fs.readFileSync(
  path.join(__dirname, "../email/selection-result-email.html"),
  "utf-8",
);

const client = new MailtrapClient({ token: config.mailtrapApiKey, bulk: true });
const sender = { email: "noreply@caksa.id", name: "CAKSA Recruitment" };

type SelectionRecipient = {
  email: string;
  fullName: string;
  interestedWingCode: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

const renderSelectionResultEmail = (recipient: SelectionRecipient): string => {
  const nextStages = ["technical", "research-development"].includes(recipient.interestedWingCode)
    ? "Test skill dan wawancara"
    : "Wawancara";

  return selectionResultTemplate
    .replaceAll("{{fullName}}", escapeHtml(recipient.fullName))
    .replaceAll("{{nextStages}}", nextStages);
};

export async function sendSelectionResultEmails(recipients: SelectionRecipient[]) {
  await Promise.all(
    recipients.map((recipient) =>
      client.send({
        from: sender,
        to: [{ email: recipient.email }],
        subject: "Lolos Seleksi Administrasi — CAKSA Recruitment 2026",
        html: renderSelectionResultEmail(recipient),
        category: "CAKSA Recruitment 2026",
      }),
    ),
  );
}
