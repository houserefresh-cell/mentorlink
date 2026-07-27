export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";
export const YOM_KIPPUR_MESSAGE = "לא ניתן לקבוע פגישות ביום כיפור.";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function partsAt(date: Date, timeZone = ISRAEL_TIME_ZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function israelLocalDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(target);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsAt(result);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    result = new Date(result.getTime() + target - represented);
  }
  return result;
}

export function israelDate(date: Date) {
  const parts = partsAt(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function yomKippurDate(gregorianYear: number) {
  const formatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {
    timeZone: ISRAEL_TIME_ZONE,
    day: "numeric",
    month: "long",
  });
  for (let day = 1; day <= 70; day += 1) {
    const candidate = new Date(Date.UTC(gregorianYear, 8, day, 12));
    const parts = formatter.formatToParts(candidate);
    const hebrewDay = Number(parts.find((part) => part.type === "day")?.value);
    const month = parts.find((part) => part.type === "month")?.value;
    if (hebrewDay === 10 && month === "Tishri") {
      return israelDate(candidate);
    }
  }
  throw new Error(`Unable to calculate Yom Kippur for ${gregorianYear}`);
}

export function yomKippurBlackout(gregorianYear: number) {
  const holiday = yomKippurDate(gregorianYear);
  return {
    startsAt: israelLocalDateTimeToUtc(addDays(holiday, -1), "16:00"),
    endsAt: israelLocalDateTimeToUtc(holiday, "21:00"),
  };
}

export function overlapsYomKippur(start: Date, end: Date) {
  const localYear = Number(israelDate(start).slice(0, 4));
  return [localYear - 1, localYear, localYear + 1].some((year) => {
    const blackout = yomKippurBlackout(year);
    return start < blackout.endsAt && end > blackout.startsAt;
  });
}
