import assert from "node:assert/strict";
import test from "node:test";
import { isActiveGeneralInquiry, isUpcomingApprovedMeeting, requiresMentorAction, waitsForParentAction } from "./mentor-dashboard-status.ts";
const now=new Date("2026-07-30T12:00:00Z").getTime();
test("mentor action includes only pending",()=>{for(const status of["pending","alternative_proposed","accepted","declined","cancelled"])assert.equal(requiresMentorAction({status}),status==="pending")});
test("waiting for parent includes new requests and reschedules of accepted meetings",()=>{
 assert.equal(waitsForParentAction({status:"alternative_proposed",proposed_start_at:"2026-08-20T10:00:00Z"}),true);
 assert.equal(waitsForParentAction({status:"accepted",proposed_start_at:"2026-08-20T10:00:00Z"}),true);
 assert.equal(waitsForParentAction({status:"accepted",proposed_start_at:null}),false);
 for(const status of["pending","declined","cancelled"])assert.equal(waitsForParentAction({status}),false);
});
test("upcoming approved uses the confirmed interval and excludes every other state and past meetings",()=>{
 assert.equal(isUpcomingApprovedMeeting({status:"accepted",confirmed_start_at:"2026-07-30T13:00:00Z"},now),true);
 assert.equal(isUpcomingApprovedMeeting({status:"accepted",confirmed_start_at:"2026-07-30T11:00:00Z"},now),false);
 assert.equal(isUpcomingApprovedMeeting({status:"accepted",confirmed_start_at:null},now),false);
 for(const status of["pending","alternative_proposed","declined","cancelled"])assert.equal(isUpcomingApprovedMeeting({status,confirmed_start_at:"2026-07-30T13:00:00Z"},now),false);
});
test("active inquiries exclude handled and meeting statuses",()=>{assert.equal(isActiveGeneralInquiry({status:"pending"}),true);assert.equal(isActiveGeneralInquiry({status:"responded"}),true);assert.equal(isActiveGeneralInquiry({status:"closed"}),false);assert.equal(isActiveGeneralInquiry({status:"cancelled"}),false);assert.equal(isActiveGeneralInquiry({status:"accepted"}),false)});
