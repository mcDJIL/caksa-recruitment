import { Router } from "express";
import { requireAdmin } from "../lib/adminSession.js"
import { sendSelectionResultEmails } from "../lib/mailtrap.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

router.post('/', requireAdmin, async (request, response, next) => {
  try {
    const { data, error } = await supabase
      .from("recruitment_applications")
      .select("email, full_name, interested_wing_code")
      .eq("status", "ADMINISTRATION");

    if (error) throw error;

    const recipients = (data ?? []).map((application) => ({
      email: application.email,
      fullName: application.full_name,
      interestedWingCode: application.interested_wing_code,
    }));

    await sendSelectionResultEmails(recipients);
    response.json({ sent: recipients.length });
  } catch (error) {
    next(error);
  }
});

export default router;