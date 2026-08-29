import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const transporter = nodemailer.createTransport({
  host: config.smtpHost,     // misal: smtp.gmail.com
  port: Number(config.smtpPort),
  secure: true,
  auth: {
    user: config.smtpUser!,
    pass: config.smtpPassword!,
  },
});

function renderTemplate(filePath: string, data: Record<string, string>) {
  let html = fs.readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(data)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

export async function sendWelcomeEmail(to: string, name: string, nrp: string) {
  const html = renderTemplate(
    path.join(__dirname, "../email/welcome-email.html"),
    {
      fullName: name,
      nrp,
      whatsappGroupLink: "https://chat.whatsapp.com/KNcAiaKtlzDHj1Pf394sM8?s=sw&p=a&mlu=4",
    }
  );

  await transporter.sendMail({
    from: 'Caksa Recruitment <recruitmentcaksaa@gmail.com',
    to,
    subject: "Pendaftaran Berhasil - CAKSA Recruitment 2026",
    html,
  });
}