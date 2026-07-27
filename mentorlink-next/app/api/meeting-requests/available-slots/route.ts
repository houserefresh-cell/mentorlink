import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { loadPublishedSchedulingMentor, loadSlots } from "@/lib/meeting-data";

export async function GET(request: Request) {
  const bookingId = new URL(request.url).searchParams.get("mentor");
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return Response.json({ error: "Invalid mentor" }, { status: 400 });
  }
  try {
    const client = createSupabaseAdmin();
    const mentor = await loadPublishedSchedulingMentor(client, bookingId);
    if (!mentor) return Response.json({ error: "Mentor not found" }, { status: 404 });
    const slots = await loadSlots(client, mentor.mentorUserId);
    return Response.json({
      mentor: {
        bookingId: mentor.publicBookingId,
        displayName: mentor.displayName,
        subjects: mentor.subjects,
        meetingModes: mentor.meetingModes,
      },
      slots,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load available slots" }, { status: 500 });
  }
}
