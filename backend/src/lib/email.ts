import { Resend } from "resend";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = new Resend(config.resendApiKey);

function renderTemplate(filePath: string, data: Record<string, string>) {
  let html = fs.readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

export async function sendWelcomeEmail(to: string, name: string, nrp: string, waLink: string) {
  const html = renderTemplate(
    path.join(__dirname, "../email/welcome-email.html"),
    { fullName: name, nrp, whatsappGroupLink: waLink }
  );

  await resend.emails.send({
    from: "CAKSA Team <caksaeepis@gmail.com>",
    to,
    subject: "Pendaftaran Berhasil - CAKSA Recruitment 2026",
    html,
  });
}