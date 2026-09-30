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
const administrationRejectionTemplate = fs.readFileSync(
  path.join(__dirname, "../email/administration-rejection-email.html"),
  "utf-8",
);
const interviewResultTemplate = fs.readFileSync(
  path.join(__dirname, "../email/interview-result-email.html"),
  "utf-8",
);
const interviewRejectionTemplate = fs.readFileSync(
  path.join(__dirname, "../email/interview-rejection-email.html"),
  "utf-8",
);
const logoContent = fs.readFileSync(path.join(__dirname, "../email/logo.png"));

const client = new MailtrapClient({ token: config.mailtrapApiKey, bulk: true });
const sender = { email: "noreply@caksa.id", name: "CAKSA Recruitment" };

type SelectionRecipient = {
  email: string;
  fullName: string;
  interestedWingCode: string;
};

type InterviewResultRecipient = SelectionRecipient & {
  interestedWingName: string;
  divisionName: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

const renderTemplate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template,
  );

const renderSelectionResultEmail = (recipient: SelectionRecipient): string => {
  const nextStages = ["technical", "research-development"].includes(recipient.interestedWingCode)
    ? "Skill Test and Interview"
    : "Interview";

  const scheduleDetails = ["technical", "research-development"].includes(recipient.interestedWingCode)
    ? `
      <tr>
        <td style="padding:8px 20px 16px; color:#6b7280; font-size:13px;">Skill Test</td>
        <td align="right" style="padding:8px 20px 16px; color:#0f1b33; font-size:13px; font-weight:700;">September 18, 2026</td>
      </tr>
      <tr>
        <td style="padding:8px 20px 16px; color:#6b7280; font-size:13px;">Interview</td>
        <td align="right" style="padding:8px 20px 16px; color:#0f1b33; font-size:13px; font-weight:700;">September 19–27, 2026</td>
      </tr>`
    : `
      <tr>
        <td style="padding:8px 20px 16px; color:#6b7280; font-size:13px;">Interview</td>
        <td align="right" style="padding:8px 20px 16px; color:#0f1b33; font-size:13px; font-weight:700;">September 19–27, 2026</td>
      </tr>`;

  return renderTemplate(selectionResultTemplate, {
    fullName: escapeHtml(recipient.fullName),
    nextStages,
    scheduleDetails,
    welcomePartyDate: "October 2, 2026 at 18:00",
    whatsappGroupLink: escapeHtml(config.whatsappGroupLink),
  });
};

const renderAdministrationRejectionEmail = (fullName: string): string =>
  renderTemplate(administrationRejectionTemplate, {
    fullName: escapeHtml(fullName),
  });

const renderInterviewResultEmail = (recipient: InterviewResultRecipient): string =>
  renderTemplate(interviewResultTemplate, {
    fullName: escapeHtml(recipient.fullName),
    interestedWingName: escapeHtml(recipient.interestedWingName),
    divisionName: escapeHtml(recipient.divisionName),
    welcomePartyDate: "October 5, 2026 at 18:00",
    whatsappGroupLink: escapeHtml("https://chat.whatsapp.com/EowXheLeDKPLT3VrGYYvcG?s=cl&p=a&mlu=4&ilr=4"),
  });

const renderInterviewRejectionEmail = (fullName: string): string =>
  renderTemplate(interviewRejectionTemplate, {
    fullName: escapeHtml(fullName),
  });

const sendEmails = async <Recipient extends SelectionRecipient>(
  recipients: Recipient[],
  subject: string,
  render: (recipient: Recipient) => string,
) => {
  await Promise.all(
    recipients.map((recipient) =>
      client.send({
        from: sender,
        to: [{ email: recipient.email }],
        subject,
        html: render(recipient),
        category: "CAKSA Recruitment 2026",
        attachments: [
          {
            filename: "logo.png",
            content_id: "caksa-logo",
            disposition: "inline",
            content: logoContent,
          },
        ],
      }),
    ),
  );
};

export async function sendSelectionResultEmails(recipients: SelectionRecipient[]) {
  await sendEmails(
    recipients,
    "Congratulations! You Passed the Administrative Selection — CAKSA Recruitment 2026",
    renderSelectionResultEmail,
  );
}

export async function sendAdministrationRejectionEmails(recipients: SelectionRecipient[]) {
  await sendEmails(
    recipients,
    "CAKSA Administrative Selection Result — CAKSA Recruitment 2026",
    (recipient) => renderAdministrationRejectionEmail(recipient.fullName),
  );
}

export async function sendInterviewResultEmails(recipients: InterviewResultRecipient[]) {
  await sendEmails(
    recipients,
    "Congratulations! You Passed the Interview — CAKSA Recruitment 2026",
    renderInterviewResultEmail,
  );
}

export async function sendInterviewRejectionEmails(recipients: SelectionRecipient[]) {
  await sendEmails(
    recipients,
    "CAKSA Interview Selection Result: Recruitment 2026",
    (recipient) => renderInterviewRejectionEmail(recipient.fullName),
  );
}
