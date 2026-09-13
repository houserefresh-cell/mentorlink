export type Severity = "critical" | "warning" | "normal";

export type AdminSummary = {
  mentorProfiles: number;
  publishedMentors: number;
  pendingMentors: number;
  pausedMentors: number;
  mentorActivities: number;
  publishedActivities: number;
  meetingRequests: number;
  pendingMeetings: number;
  acceptedMeetings: number;
  unresolvedFeedback: number;
  suspendedAccounts: number;
  blockedAccounts: number;
};

export type MeetingRow = {
  id: string;
  mentor_user_id?: string | null;
  parent_user_id?: string | null;
  status?: string | null;
  subject?: string | null;
  requested_start_at?: string | null;
  confirmed_start_at?: string | null;
  proposed_start_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  child_first_name?: string | null;
  mentor_name?: string | null;
  parent_name?: string | null;
};

export type ActivityRow = {
  id: string;
  mentor_user_id?: string | null;
  title?: string | null;
  status?: string | null;
  max_participants?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
  published_at?: string | null;
  registration_count?: number | null;
  mentor_name?: string | null;
};

export type FeedbackRow = {
  id: string;
  contextType?: "activity" | "meeting" | null;
  admin_handling_status?: string | null;
  safety_incident?: boolean | null;
  requests_admin_contact?: boolean | null;
  submitted_at?: string | null;
  contextId?: string | null;
  mentor_user_id?: string | null;
  parent_user_id?: string | null;
};

export type AttentionItem = {
  id: string;
  entityType: "meeting" | "activity" | "feedback" | "mentor";
  title: string;
  reason: string;
  severity: Severity;
  href: string;
  createdAt: string;
  relatedId?: string;
  contextLabel?: string;
};

export function normalizeStatus(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function summarizeAdminKpis(input: {
  publicationRows: Array<{ status?: string | null }>;
  activityRows: Array<{ status?: string | null }>;
  meetingRows: Array<{ status?: string | null }>;
  activityFeedbackRows: Array<{ admin_handling_status?: string | null }>;
  meetingFeedbackRows: Array<{ admin_handling_status?: string | null }>;
  controlRows: Array<{ status?: string | null }>;
}): AdminSummary {
  const publicationRows = input.publicationRows ?? [];
  const activityRows = input.activityRows ?? [];
  const meetingRows = input.meetingRows ?? [];
  const activityFeedbackRows = input.activityFeedbackRows ?? [];
  const meetingFeedbackRows = input.meetingFeedbackRows ?? [];
  const controlRows = input.controlRows ?? [];

  return {
    mentorProfiles: publicationRows.length,
    publishedMentors: publicationRows.filter((row) => normalizeStatus(row.status) === "published").length,
    pendingMentors: publicationRows.filter((row) => normalizeStatus(row.status) === "pending_review").length,
    pausedMentors: publicationRows.filter((row) => normalizeStatus(row.status) === "paused").length,
    mentorActivities: activityRows.length,
    publishedActivities: activityRows.filter((row) => normalizeStatus(row.status) === "published").length,
    meetingRequests: meetingRows.length,
    pendingMeetings: meetingRows.filter((row) => normalizeStatus(row.status) === "pending").length,
    acceptedMeetings: meetingRows.filter((row) => normalizeStatus(row.status) === "accepted").length,
    unresolvedFeedback: activityFeedbackRows.filter((row) => normalizeStatus(row.admin_handling_status) !== "resolved").length +
      meetingFeedbackRows.filter((row) => normalizeStatus(row.admin_handling_status) !== "resolved").length,
    suspendedAccounts: controlRows.filter((row) => normalizeStatus(row.status) === "suspended").length,
    blockedAccounts: controlRows.filter((row) => normalizeStatus(row.status) === "blocked").length,
  };
}

export function filterMeetingRows(rows: MeetingRow[], filters: {
  search?: string;
  status?: string;
  mentorId?: string;
  subject?: string;
  from?: string;
  to?: string;
}) {
  const search = (filters.search ?? "").trim().toLocaleLowerCase("he");
  const status = (filters.status ?? "").trim();
  const subject = (filters.subject ?? "").trim();
  const mentorId = (filters.mentorId ?? "").trim();
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() : null;

  return rows.filter((row) => {
    const date = new Date(row.requested_start_at ?? row.confirmed_start_at ?? row.proposed_start_at ?? row.created_at ?? "1970-01-01T00:00:00Z").getTime();
    if (status && normalizeStatus(row.status) !== status) return false;
    if (mentorId && row.mentor_user_id !== mentorId) return false;
    if (subject && !(row.subject ?? "").toLocaleLowerCase("he").includes(subject.toLocaleLowerCase("he"))) return false;
    if (from !== null && date < from) return false;
    if (to !== null && date > to) return false;
    if (!search) return true;
    const haystack = [row.subject, row.mentor_name, row.parent_name, row.child_first_name, row.status].filter(Boolean).join(" ").toLocaleLowerCase("he");
    return haystack.includes(search);
  });
}

export function filterActivityRows(rows: ActivityRow[], filters: {
  search?: string;
  status?: string;
  mentorId?: string;
  from?: string;
  to?: string;
}) {
  const search = (filters.search ?? "").trim().toLocaleLowerCase("he");
  const status = (filters.status ?? "").trim();
  const mentorId = (filters.mentorId ?? "").trim();
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() : null;

  return rows.filter((row) => {
    const date = new Date(row.created_at ?? row.updated_at ?? row.published_at ?? "1970-01-01T00:00:00Z").getTime();
    if (status && normalizeStatus(row.status) !== status) return false;
    if (mentorId && row.mentor_user_id !== mentorId) return false;
    if (from !== null && date < from) return false;
    if (to !== null && date > to) return false;
    if (!search) return true;
    const haystack = [row.title, row.mentor_name, row.status].filter(Boolean).join(" ").toLocaleLowerCase("he");
    return haystack.includes(search);
  });
}

export function classifyAdminAttention(input: {
  meetings: MeetingRow[];
  activities: ActivityRow[];
  feedback: FeedbackRow[];
}) {
  const now = Date.now();
  const attention: AttentionItem[] = [];

  for (const meeting of input.meetings ?? []) {
    const status = normalizeStatus(meeting.status);
    const requestedAt = meeting.requested_start_at ? new Date(meeting.requested_start_at).getTime() : null;
    const cancelledAt = meeting.cancelled_at ? new Date(meeting.cancelled_at).getTime() : null;
    if (status === "pending" && requestedAt && requestedAt < now - 1000 * 60 * 60 * 24 * 2) {
      attention.push({
        id: `meeting-pending-${meeting.id}`,
        entityType: "meeting",
        title: `פגישה ממתינה לחונך / הורה`,
        reason: "בקשת פגישה נותרה פתוחה יותר מ־48 שעות.",
        severity: "warning",
        href: `/dashboard/admin/meetings?meeting=${meeting.id}`,
        createdAt: meeting.requested_start_at ?? new Date().toISOString(),
        relatedId: meeting.id,
        contextLabel: meeting.subject ?? "פגישה",
      });
    }
    if ((status === "pending" || status === "alternative_proposed") && requestedAt && requestedAt < now) {
      attention.push({
        id: `meeting-overdue-${meeting.id}`,
        entityType: "meeting",
        title: `פגישה שלא נסגרה בזמן`,
        reason: "המועד עבר אך המצב עדיין לא ננעל או בוטל.",
        severity: "critical",
        href: `/dashboard/admin/meetings?meeting=${meeting.id}`,
        createdAt: meeting.updated_at ?? meeting.requested_start_at ?? new Date().toISOString(),
        relatedId: meeting.id,
        contextLabel: meeting.subject ?? "פגישה",
      });
    }
    if (status === "cancelled" && cancelledAt && cancelledAt > now - 1000 * 60 * 60 * 24 * 7) {
      attention.push({
        id: `meeting-cancelled-${meeting.id}`,
        entityType: "meeting",
        title: `ביטול חדש`,
        reason: "הפגישה בוטלה בזמן האחרון וראויה לעקיבה.",
        severity: "normal",
        href: `/dashboard/admin/meetings?meeting=${meeting.id}`,
        createdAt: meeting.cancelled_at ?? new Date().toISOString(),
        relatedId: meeting.id,
        contextLabel: meeting.subject ?? "פגישה",
      });
    }
  }

  for (const activity of input.activities ?? []) {
    const regCount = Number(activity.registration_count ?? 0);
    const cap = Number(activity.max_participants ?? 0);
    if (cap > 0 && regCount >= cap) {
      attention.push({
        id: `activity-full-${activity.id}`,
        entityType: "activity",
        title: `פעילות כמעט מלאה / מלאה`,
        reason: "הפעילות הגיעה לקיבולת או קרובה לה.",
        severity: regCount >= cap ? "critical" : "warning",
        href: `/dashboard/admin/activities?activity=${activity.id}`,
        createdAt: activity.updated_at ?? activity.created_at ?? new Date().toISOString(),
        relatedId: activity.id,
        contextLabel: activity.title ?? "פעילות",
      });
    }
  }

  for (const item of input.feedback ?? []) {
    const status = normalizeStatus(item.admin_handling_status);
    const shouldFlag = status !== "resolved" && (Boolean(item.safety_incident) || Boolean(item.requests_admin_contact));
    if (shouldFlag) {
      attention.push({
        id: `feedback-${item.id}`,
        entityType: "feedback",
        title: `משוב עם התייחסות ניהולית`,
        reason: "משוב כולל דיווח בטיחותי או בקשת יצירת קשר עם מנהל.",
        severity: item.safety_incident ? "critical" : "warning",
        href: `/dashboard/admin/feedback`,
        createdAt: item.submitted_at ?? new Date().toISOString(),
        relatedId: item.id,
        contextLabel: item.contextType === "meeting" ? "פגישה" : "פעילות",
      });
    }
  }

  return attention.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
