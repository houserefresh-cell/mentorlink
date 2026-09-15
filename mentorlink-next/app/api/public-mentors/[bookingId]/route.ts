import { authenticateMeetingUser } from "@/lib/meeting-auth";
import { getPublishedMentors } from "@/lib/public-mentor-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return Response.json({ error: "Mentor not found" }, { status: 404 });
  }
  try {
    const user = await authenticateMeetingUser(request.headers.get("authorization"));
    const mentors = await getPublishedMentors();
    const mentor = mentors.find((item) => item.bookingId === bookingId);
    if (!mentor) return Response.json({ error: "Mentor not found" }, { status: 404 });
    return Response.json({ mentor }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return Response.json({ error: "Unable to load mentor" }, { status: 500 });
  }
}


