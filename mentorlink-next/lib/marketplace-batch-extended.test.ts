import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("password recovery is branded, generic to anonymous users and available to administrators", async () => {
  const [login, requestRoute, helper, callback, adminRoute] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password-reset/request/route.ts", import.meta.url), "utf8"),
    readFile(new URL("./password-recovery.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/callback/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/password-reset/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(login, /שכחתי סיסמה/);
  assert.match(requestRoute, /אם קיים חשבון/);
  assert.doesNotMatch(requestRoute, /user not found/i);
  assert.match(helper, /RESEND_API_KEY/);
  assert.match(helper, /generateLink/);
  assert.match(helper, /options: \{ redirectTo \}/);
  assert.match(helper, /https:\/\/mentorlink\.co\.il/);
  assert.match(helper, /properties\?\.action_link/);
  assert.doesNotMatch(helper, /recoveryUrl\.searchParams\.set\("token_hash"/);
  assert.match(callback, /password_recovery/);
  assert.match(callback, /token_hash/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /type: "recovery"/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /access_token/);
  assert.match(callback, /refresh_token/);
  assert.match(callback, /setSession/);
  assert.match(callback, /מאמת את קישור איפוס הסיסמה/);
  assert.match(adminRoute, /authorizeAdministrator/);
});

test("reset flow reports same-password explicitly without blaming an expired link", async () => {
  const page = await readFile(new URL("../app/account/reset-password/page.tsx", import.meta.url), "utf8");
  assert.match(page, /same_password/i);
  assert.match(page, /הסיסמה שהזנת זהה לסיסמה הנוכחית/);
});

test("expired meeting requests are cancelled with reasons and parent lists are date ordered", async () => {
  const [route, actionRoute, panel] = await Promise.all([
    readFile(new URL("../app/api/meeting-requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/meeting-requests/[requestId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/_components/MeetingRequestsPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /החונך לא אישר את הפגישה בזמן/);
  assert.match(actionRoute, /יש לציין סיבה קצרה לביטול/);
  assert.match(actionRoute, /cancellation_reason/);
  assert.match(panel, /byMeetingDate/);
  assert.match(panel, /סיבת הביטול/);
});

test("mentor profile and activity hero use one reusable branded visual system", async () => {
  const [directory, activity, profile, nameButton] = await Promise.all([
    readFile(new URL("../app/_components/PublicMentorDirectory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/parent/_components/ParentActivityDiscovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/MentorProfileDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/MentorNameButton.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(directory, /MentorProfileDialog/);
  assert.match(activity, /ActivityHero/);
  assert.match(activity, /mentorlink-logo\.png/);
  assert.match(activity, /MentorNameButton/);
  assert.match(profile, /mentorlink-logo\.png/);
  assert.match(nameButton, /api\/public-mentors/);
});
