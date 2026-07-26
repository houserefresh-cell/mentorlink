import { revalidatePath } from "next/cache";
import { adminApiError, adminApiSuccess } from "@/lib/admin-api";
import { updateMentorPublicationWithAdminClient } from "@/lib/admin-publication-action";
import {
  parsePublicationCommand,
  PublicationInputError,
} from "@/lib/admin-publication-action-core";
import { authorizeAdministrator } from "@/lib/admin-authorization";
import { isUuid } from "@/lib/admin-authorization-core";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const administrator = await authorizeAdministrator(
      request.headers.get("authorization"),
    );
    const { userId } = await params;
    if (!isUuid(userId) || userId === administrator.id) {
      return Response.json(
        { error: "Mentor publication not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await updateMentorPublicationWithAdminClient({
      admin: createSupabaseAdmin(),
      userId,
      administratorId: administrator.id,
      command: parsePublicationCommand(payload),
    });
    if (result.outcome === "not_found") {
      return Response.json(
        { error: "Mentor publication not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.outcome === "conflict") {
      return Response.json(
        { error: "The mentor publication status has changed" },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (result.outcome === "publication_blocked") {
      return Response.json(
        { error: result.message },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }
    revalidatePath("/");
    return adminApiSuccess({ publication: result });
  } catch (error) {
    if (error instanceof PublicationInputError) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    return adminApiError(error);
  }
}
