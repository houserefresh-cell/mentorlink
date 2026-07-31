export const SUBJECT_CATEGORIES = [
  "ספורט",
  "לימודים",
  "מוזיקה",
  "אומנות ויצירה",
  "טכנולוגיה",
  "שפות",
  "כישורי חיים והעשרה",
] as const;

export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

const BLOCKED_TERMS = [
  "זונה",
  "שרמוט",
  "סקס",
  "פורנו",
  "הימורים",
  "קזינו",
  "הלוואה",
  "מבצע",
  "פרסום",
];

export function normalizeSubjectName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s׳'״"-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function subjectComparisonKey(value: string) {
  return normalizeSubjectName(value)
    .toLocaleLowerCase("he")
    .replace(/["'׳״\s-]/g, "");
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function validateProposedSubject(
  rawName: string,
  existingNames: string[],
) {
  const name = normalizeSubjectName(rawName);
  const key = subjectComparisonKey(name);

  if (name.length < 2 || name.length > 50) {
    return { ok: false as const, code: "INVALID_LENGTH" };
  }
  if (!/[\p{L}]/u.test(name) || /(.)\1{4,}/u.test(name)) {
    return { ok: false as const, code: "MEANINGLESS_NAME" };
  }
  if (BLOCKED_TERMS.some((term) => key.includes(subjectComparisonKey(term)))) {
    return { ok: false as const, code: "BLOCKED_CONTENT" };
  }

  const duplicate = existingNames.find((existing) => {
    const existingKey = subjectComparisonKey(existing);
    if (existingKey === key) return true;
    if (Math.min(existingKey.length, key.length) < 5) return false;
    return editDistance(existingKey, key) <= 1;
  });

  if (duplicate) {
    return { ok: false as const, code: "DUPLICATE", duplicate };
  }

  return { ok: true as const, name, normalizedName: key };
}
