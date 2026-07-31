import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const shell=read("app/dashboard/mentor/_components/MentorDashboardShell.tsx");

test("mentor sidebar has the exact requested order",()=>{
 const labels=["עמוד הבית","בקשות ופגישות","פניות מהורים","הזמינות שלי","המקצועות והתחומים שלי","פתיחת פעילות חדשה","הפעילויות שלי","חיפוש חונכים ופעילויות","החשבון שלי"];
 let position=-1;for(const label of labels){const next=shell.indexOf(`label:"${label}"`);assert.ok(next>position,`${label} must appear in order`);position=next}
});
test("shell is role guarded and accessible on desktop and mobile",()=>{
 assert.match(shell,/getDashboardPath/);assert.match(shell,/destination!==["']\/dashboard\/mentor["']/);
 assert.match(shell,/lg:grid-cols-\[18rem_minmax\(0,1fr\)\]/);assert.match(shell,/sticky top-\[69px\]/);
 assert.match(shell,/ניווט חונכים בנייד/);assert.match(shell,/aria-current/);assert.match(shell,/פתיחת תפריט החונכים/);
});
test("badges count only mentor-action meetings and active general inquiries",()=>{
 assert.match(shell,/filter\(requiresMentorAction\)/);assert.match(shell,/filter\(waitsForParentAction\)/);
 assert.match(shell,/filter\(isActiveGeneralInquiry\)/);assert.match(shell,/badge===["']meetings["']/);assert.match(shell,/badge===["']inquiries["']/);
});
test("authenticated mentor header retains identity and logout without guest actions",()=>{
 assert.match(shell,/user_metadata\?\.first_name/);assert.match(shell,/התנתקות/);
 assert.doesNotMatch(shell,/הרשמה כחונך|מציאת חונך|href="\/login"/);
});
test("home and permanent routes are real",()=>{
 const home=read("app/dashboard/mentor/page.tsx");
 assert.match(home,/בקשות פגישה שמחכות לפעולתך/);assert.match(home,/פניות כלליות פעילות/);assert.match(home,/מצב הזמינות/);assert.match(home,/מצב הפרופיל/);
 assert.match(read("app/dashboard/mentor/meetings/page.tsx"),/MeetingRequestsPanel role="mentor"/);
 assert.match(read("app/dashboard/mentor/scheduling/page.tsx"),/MentorPageShell/);
 assert.ok(read("app/dashboard/mentor/profile/page.tsx").length>0);
});
test("meetings and general inquiries remain separate",()=>{
 const meetings=read("app/dashboard/mentor/meetings/page.tsx"),inquiries=read("app/dashboard/mentor/_components/MentorGeneralInquiriesPanel.tsx");
 assert.doesNotMatch(meetings,/טופלה|פניות פעילות/);assert.match(inquiries,/פניות פעילות/);assert.match(inquiries,/פניות שטופלו/);assert.match(inquiries,/סימון הפנייה כטופלה/);
 assert.doesNotMatch(inquiries,/MeetingRequestsPanel|propose_alternative|accept_alternative/);
});
test("activity routes are honest placeholders",()=>{
 for(const path of["app/dashboard/mentor/activities/page.tsx","app/dashboard/mentor/activities/new/page.tsx"]){const source=read(path);assert.match(source,/בשלב הבא|בבנייה/);assert.match(source,/עצמאית מהזמינות/)}
});
test("mentor discovery reuses public projection and disables parent-only actions",()=>{
 const page=read("app/dashboard/mentor/discover/page.tsx"),directory=read("app/_components/PublicMentorDirectory.tsx");
 assert.match(page,/getPublishedMentors/);assert.match(page,/PublicMentorDirectory/);assert.match(page,/interactionMode="read-only"/);
 assert.match(directory,/interactionMode\?:"parent"\|"read-only"/);assert.match(directory,/!readOnly && <button/);assert.match(directory,/interactionMode==="parent"&&activeInteraction/);
});
test("parent dashboard implementation is unchanged and remains role guarded",()=>{
 const parent=read("app/dashboard/parent/_components/ParentDashboardShell.tsx");
 assert.match(parent,/dashboardPath!==["']\/dashboard\/parent["']/);assert.match(parent,/ParentDashboardContext/);
});
