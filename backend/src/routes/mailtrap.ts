import { Router } from "express";
import { requireAdmin } from "../lib/adminSession.js"
import {
  sendAdministrationRejectionEmails,
  sendInterviewResultEmails,
  sendSelectionResultEmails,
} from "../lib/mailtrap.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

const isEmail = (value: unknown): value is string =>
  typeof value === "string" && value.trim().includes("@");

const sendBroadcast = async (
  status: "ADMINISTRATION" | "INTERVIEW" | "MEMBER" | "NOT_SELECTED_ADMINISTRATION",
  sendEmails: typeof sendSelectionResultEmails,
  response: Parameters<Parameters<typeof router.post>[1]>[1],
  next: Parameters<Parameters<typeof router.post>[1]>[2],
) => {
  try {
    const { data, error } = await supabase
      .from("recruitment_applications")
      .select("email, full_name, interested_wing_code")
      .eq("status", status);

    if (error) throw error;

    const recipients = (data ?? []).map((application) => ({
      email: application.email,
      fullName: application.full_name,
      interestedWingCode: application.interested_wing_code,
    }));

    await sendEmails(recipients);
    response.json({ sent: recipients.length });
  } catch (error) {
    next(error);
  }
};

router.post('/', requireAdmin, (request, response, next) =>
  sendBroadcast("ADMINISTRATION", sendSelectionResultEmails, response, next),
);

router.post('/interview-result', requireAdmin, (request, response, next) =>
  sendBroadcast("MEMBER", sendInterviewResultEmails, response, next),
);

router.post('/not-selected-administration', requireAdmin, (request, response, next) =>
  sendBroadcast(
    "NOT_SELECTED_ADMINISTRATION",
    sendAdministrationRejectionEmails,
    response,
    next,
  ),
);

router.post('/administration-test', requireAdmin, async (request, response, next) => {
  try {
    const { passEmail, rejectionEmail } = request.body as {
      passEmail?: unknown;
      rejectionEmail?: unknown;
    };

    if (!isEmail(passEmail) || !isEmail(rejectionEmail)) {
      response.status(400).json({ error: "Dua email uji yang valid wajib diisi" });
      return;
    }

    const recipients = [
      {
        email: passEmail.trim().toLowerCase(),
        fullName: "CAKSA Test Candidate",
        interestedWingCode: "technical",
      },
    ];
    const rejectionRecipients = [
      {
        email: rejectionEmail.trim().toLowerCase(),
        fullName: "CAKSA Test Candidate",
        interestedWingCode: "technical",
      },
    ];

    await Promise.all([
      sendSelectionResultEmails(recipients),
      sendAdministrationRejectionEmails(rejectionRecipients),
    ]);
    response.json({ sent: 2 });
  } catch (error) {
    next(error);
  }
});

export default router;
