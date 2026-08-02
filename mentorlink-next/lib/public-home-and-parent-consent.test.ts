import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("app/page.tsx");
const verify = read("app/parent-consent/verify/page.tsx");
const verifyApi = read("app/api/parent-consent/verify/route.ts");
const publicData = read("lib/public-mentor-data.ts");
const migration = read("supabase/migrations/202608020030_add_parent_consent_role_and_photo_choice.sql");

test("public home leads with community and separate parent and mentor actions", () => {
  assert.match(home, /import \{ Rubik \} from "next\/font\/google"/);
  assert.match(home, /homeBodyFont\.className/);
  assert.doesNotMatch(home, /homeHeadingFont|Secular_One/);
  assert.doesNotMatch(home, /group rounded-3xl p-5 transition hover:-translate-y-1/);
  assert.match(home, /אנשים קרובים/);
  assert.match(home, /חיבורים שמקדמים/);
  assert.match(home, /אני הורה — מתחילים כאן/);
  assert.match(home, /יש לי מה לתת — הרשמה כחונך/);
  assert.doesNotMatch(home, /בתהליך ברור ובטוח/);
});

test("new minor registration requires parent consent immediately after saving the birth date", () => {
  const onboarding = read("app/dashboard/mentor/onboarding/page.tsx");
  assert.match(onboarding, /const minor = age < 18;[\s\S]*setIsMinor\(minor\);/);
  assert.match(onboarding, /setConsentStatusLabel\(getConsentStatusLabel\(consentStatus, minor\)\)/);
  assert.match(onboarding, /isMinor && consentStatus !== "approved"/);
  assert.match(onboarding, /לחונך שטרם מלאו לו 18 נדרש אישור הורה מאומת/);
  assert.doesNotMatch(onboarding, /שגיאה בשליחה: \$\{error\.message\}/);
});

test("platform role is explained naturally rather than presented as a blanket waiver", () => {
  assert.match(home, /הפלטפורמה מחברת/);
  assert.match(home, /אינה מחליפה היכרות אישית/);
  assert.match(home, /ההחלטה על מפגש, מיקומו ותנאיו מתקבלת בין החונך לבין ההורה/);
});

test("parent approval requires platform-role acknowledgement and keeps photo consent optional", () => {
  assert.match(verify, /platformRoleConfirmed/);
  assert.match(verify, /אישור רשות נפרד/);
  assert.match(verify, /הסימון אינו חובה להשתתפות/);
  assert.match(verifyApi, /confirmed_platform_role/);
  assert.match(verifyApi, /confirmed_public_photo/);
});

test("photo visibility is recorded atomically and public photos require explicit approval", () => {
  assert.match(migration, /profile_photo_visibility in \('hidden', 'public'\)/);
  assert.match(migration, /confirmed_platform_role/);
  assert.match(migration, /case when confirmed_public_photo then 'public' else 'hidden' end/);
  assert.match(publicData, /consent\?\.status !== "approved"/);
  assert.match(publicData, /consent\.profile_photo_visibility !== "public"/);
});
