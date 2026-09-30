import { Router } from "express";
import { requireAdmin } from "../lib/adminSession.js"
import {
  sendAdministrationRejectionEmails,
  sendInterviewRejectionEmails,
  sendInterviewResultEmails,
  sendSelectionResultEmails,
} from "../lib/mailtrap.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

const isEmail = (value: unknown): value is string =>
  typeof value === "string" && value.trim().includes("@");

const sendBroadcast = async (
  status: "ADMINISTRATION" | "INTERVIEW" | "MEMBER" | "NOT_SELECTED_ADMINISTRATION" | "NOT_SELECTED_INTERVIEW",
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

router.post('/interview-result', requireAdmin, async (request, response, next) => {
  try {
    const [applicationsResult, wingsResult, divisionsResult] = await Promise.all([
      supabase
        .from("recruitment_applications")
        .select("email, full_name, interested_wing_code, division_code")
        .eq("status", "MEMBER"),
      supabase.from("interested_wings").select("code, name"),
      supabase.from("divisions").select("code, interested_wing_code, name"),
    ]);

    if (applicationsResult.error) throw applicationsResult.error;
    if (wingsResult.error) throw wingsResult.error;
    if (divisionsResult.error) throw divisionsResult.error;

    const wingNameByCode = new Map(
      (wingsResult.data ?? []).map((wing) => [wing.code, wing.name] as const),
    );
    const divisionNameByCode = new Map(
      (divisionsResult.data ?? []).map((division) => [
        `${division.interested_wing_code}:${division.code}`,
        division.name,
      ] as const),
    );

    const recipients = (applicationsResult.data ?? []).map((application) => ({
      email: application.email,
      fullName: application.full_name,
      interestedWingCode: application.interested_wing_code,
      interestedWingName: wingNameByCode.get(application.interested_wing_code)!,
      divisionName: divisionNameByCode.get(
        `${application.interested_wing_code}:${application.division_code}`,
      )!,
    }));

    await sendInterviewResultEmails(recipients);
    response.json({ sent: recipients.length });
  } catch (error) {
    next(error);
  }
});

router.post('/not-selected-administration', requireAdmin, (request, response, next) =>
  sendBroadcast(
    "NOT_SELECTED_ADMINISTRATION",
    sendAdministrationRejectionEmails,
    response,
    next,
  ),
);

router.post('/not-selected-interview', requireAdmin, (request, response, next) =>
  sendBroadcast(
    "NOT_SELECTED_INTERVIEW",
    sendInterviewRejectionEmails,
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

router.post('/interview-result-test', requireAdmin, async (request, response, next) => {
  try {
    const { email } = request.body as { email?: unknown };

    if (!isEmail(email)) {
      response.status(400).json({ error: "Email uji yang valid wajib diisi" });
      return;
    }

    await sendInterviewResultEmails([
      {
        email: email.trim().toLowerCase(),
        fullName: "CAKSA Test Candidate",
        interestedWingCode: "technical",
        interestedWingName: "Technical",
        divisionName: "Electrical",
      },
    ]);
    response.json({ sent: 1 });
  } catch (error) {
    next(error);
  }
});

router.post('/interview-rejection-test', requireAdmin, async (request, response, next) => {
  try {
    const { email } = request.body as { email?: unknown };

    if (!isEmail(email)) {
      response.status(400).json({ error: "Email uji yang valid wajib diisi" });
      return;
    }

    await sendInterviewRejectionEmails([
      {
        email: email.trim().toLowerCase(),
        fullName: "CAKSA Test Candidate",
        interestedWingCode: "technical",
      },
    ]);
    response.json({ sent: 1 });
  } catch (error) {
    next(error);
  }
});

export default router;
