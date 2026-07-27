import {
  ISRAEL_TIME_ZONE,
  israelDate,
  israelLocalDateTimeToUtc,
  overlapsYomKippur,
} from "./israel-calendar.ts";

export const MEETING_DURATIONS = [30, 45, 60, 90] as const;
export const MEETING_MODES = ["פרונטלי", "אונליין"] as const;
export const MEETING_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "alternative_proposed",
  "cancelled",
] as const;

export type AvailabilityWindow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  meeting_mode: string;
  supported_durations: number[];
  is_active: boolean;
  effective_start_date: string | null;
  effective_end_date: string | null;
  timezone: string;
};

export type TimePeriod = { starts_at: string; ends_at: string };
export type BookableSlot = {
  startAt: string;
  meetingMode: string;
  durations: number[];
};

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function overlaps(start: Date, end: Date, period: TimePeriod) {
  return start < new Date(period.ends_at) && end > new Date(period.starts_at);
}

export function generateBookableSlots(input: {
  windows: AvailabilityWindow[];
  blackouts: TimePeriod[];
  accepted: TimePeriod[];
  now: Date;
  days?: number;
}) {
  const slots: BookableSlot[] = [];
  const firstDate = israelDate(input.now);
  const dayCount = Math.min(Math.max(input.days ?? 30, 1), 60);

  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(firstDate, offset);
    for (const window of input.windows) {
      if (
        !window.is_active ||
        window.timezone !== ISRAEL_TIME_ZONE ||
        window.weekday !== weekday(date) ||
        (window.effective_start_date && date < window.effective_start_date) ||
        (window.effective_end_date && date > window.effective_end_date)
      ) continue;

      const windowStart = israelLocalDateTimeToUtc(date, window.start_time);
      const windowEnd = israelLocalDateTimeToUtc(date, window.end_time);
      for (
        let startMs = windowStart.getTime();
        startMs < windowEnd.getTime();
        startMs += 15 * 60_000
      ) {
        const start = new Date(startMs);
        if (start <= input.now) continue;
        const durations = window.supported_durations
          .filter((duration) => MEETING_DURATIONS.includes(duration as never))
          .filter((duration) => {
            const end = new Date(startMs + duration * 60_000);
            return (
              end <= windowEnd &&
              !overlapsYomKippur(start, end) &&
              !input.blackouts.some((period) => overlaps(start, end, period)) &&
              !input.accepted.some((period) => overlaps(start, end, period))
            );
          });
        if (durations.length) {
          slots.push({
            startAt: start.toISOString(),
            meetingMode: window.meeting_mode,
            durations,
          });
        }
      }
    }
  }
  return slots;
}

export function isCurrentGeneratedSlot(
  slots: BookableSlot[],
  startAt: string,
  meetingMode: string,
  duration: number,
) {
  return slots.some(
    (slot) =>
      slot.startAt === new Date(startAt).toISOString() &&
      slot.meetingMode === meetingMode &&
      slot.durations.includes(duration),
  );
}

export function canTransition(
  actor: "parent" | "mentor",
  status: string,
  action: string,
) {
  if (actor === "parent") {
    return action === "cancel" && ["pending", "alternative_proposed"].includes(status);
  }
  return (
    status === "pending" &&
    ["accept", "decline", "propose_alternative"].includes(action)
  );
}
