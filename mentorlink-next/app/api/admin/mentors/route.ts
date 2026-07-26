import { authorizeAdministrator } from "@/lib/admin-authorization";
import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { getPendingMentors } from "@/lib/admin-mentor-data";

export async function GET(request: Request) {
  try {
    const administrator = await authorizeAdministrator(
      request.headers.get("authorization"),
    );
    return adminApiSuccess({
      mentors: await getPendingMentors(administrator.id),
    });
  } catch (error) {
    return adminApiError(error);
  }
}
