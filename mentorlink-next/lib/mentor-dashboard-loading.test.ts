import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const meetings=read("app/dashboard/_components/MeetingRequestsPanel.tsx");
const inquiries=read("app/dashboard/mentor/_components/MentorGeneralInquiriesPanel.tsx");
const meetingFlow=read("app/_components/MeetingRequestFlow.tsx");
const mentorHome=read("app/dashboard/mentor/page.tsx");
const mentorShell=read("app/dashboard/mentor/_components/MentorDashboardShell.tsx");
const scheduling=read("app/dashboard/mentor/scheduling/page.tsx");

test("meetings distinguish loading loaded-empty and error",()=>{
 assert.match(meetings,/useState<"loading" \| "loaded" \| "error">\("loading"\)/);
 assert.match(meetings,/loadState === "loading"[\s\S]*טוען פגישות/);
 assert.match(meetings,/loadState === "error"[\s\S]*ניסיון נוסף/);
 assert.ok(meetings.indexOf('loadState === "loading"')<meetings.indexOf("<RequestList"));
});
test("inquiries distinguish loading loaded-empty and error",()=>{
 assert.match(inquiries,/useState<"loading"\|"loaded"\|"error">\("loading"\)/);
 assert.match(inquiries,/loadState==="loading"[\s\S]*טוען פניות/);
 assert.match(inquiries,/loadState==="error"[\s\S]*ניסיון נוסף/);
 assert.ok(inquiries.indexOf('loadState==="loading"')<inquiries.indexOf("!items.length"));
});
test("auth resolution precedes signed-out and non-parent messages",()=>{
 assert.match(meetingFlow,/authState.*"resolving".*"resolved"/);
 const loading=meetingFlow.indexOf('authState === "resolving"');
 const signedOut=meetingFlow.indexOf("!accessToken ?",loading);
 const wrongRole=meetingFlow.indexOf('role !== "parent"',signedOut);
 assert.ok(loading>=0&&signedOut>loading&&wrongRole>signedOut);
 assert.match(meetingFlow,/בודק הרשאה/);
});
test("mentor home never presents unresolved or failed summaries as empty counts",()=>{
 assert.match(mentorShell,/summaryState:"loading"\|"loaded"\|"error"/);
 assert.match(mentorHome,/summaryState==="loading"[\s\S]*טוען את סיכום הפעילות/);
 assert.match(mentorHome,/summaryState==="error"[\s\S]*לא ניתן לטעון/);
});
test("summary destinations target the matching predicate-backed sections",()=>{
 for(const hash of["#mentor-action","#waiting-parent","#upcoming-approved","#active-inquiries"])assert.match(mentorHome,new RegExp(hash));
 for(const id of["mentor-action","waiting-parent","upcoming-approved"])assert.match(meetings,new RegExp(`id="${id}"`));
 assert.match(inquiries,/id="active-inquiries"/);
 assert.match(mentorShell,/filter\(requiresMentorAction\)/);
 assert.match(meetings,/filter\(requiresMentorAction\)/);
});
test("availability actions keep their handlers and gain clear affordance",()=>{
 assert.match(scheduling,/onClick=\{\(\) => toggle\(window\)\}/);
 assert.match(scheduling,/remove\(window\.id, "window"\)/);
 assert.match(scheduling,/cursor-pointer/);assert.match(scheduling,/hover:bg-blue-100/);
 assert.match(scheduling,/focus-visible:outline/);assert.match(scheduling,/disabled:cursor-not-allowed/);
 assert.match(scheduling,/border-red-300 bg-red-50/);assert.match(scheduling,/border-amber-300/);assert.match(scheduling,/border-emerald-300/);
});
