import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { loadPublishedSchedulingMentor, loadSlots } from "@/lib/meeting-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("mentor");
  const requestedDays = Number(url.searchParams.get("days") ?? 30);
  const days = requestedDays === 60 ? 60 : 30;
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) return Response.json({ error: "Invalid mentor", code: "INVALID_MENTOR" }, { status: 400 });
  try {
    const client = createSupabaseAdmin();
    const mentor = await loadPublishedSchedulingMentor(client, bookingId);
    if (!mentor) return Response.json({ error: "Mentor not found", code: "MENTOR_NOT_FOUND" }, { status: 404 });
    const [slots, windows] = await Promise.all([
      loadSlots(client, mentor.mentorUserId, new Date(), days),
      client.from("mentor_availability_windows").select("id", { count: "exact", head: true }).eq("mentor_user_id", mentor.mentorUserId).eq("is_active", true),
    ]);
    if (windows.error) throw new Error("window count failed");
    const availabilityWindowCount = windows.count ?? 0;
    const emptyReason = slots.length ? null : availabilityWindowCount === 0 ? "NO_AVAILABILITY" : "NO_OPEN_SLOTS";
    console.info("Meeting slot generation", { stage: "complete", days, availabilityWindowCount, slotCount: slots.length, emptyReason });
    return Response.json({
      mentor: { bookingId: mentor.publicBookingId, displayName: mentor.displayName, subjects: mentor.subjects, meetingModes: mentor.meetingModes },
      slots,
      availability: { windowCount: availabilityWindowCount, emptyReason, horizonDays: days },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.info("Meeting slot generation", { stage: "failed", errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "לא ניתן לטעון מועדים זמינים.", code: "SLOT_LOAD_FAILED" }, { status: 500 });
  }
}