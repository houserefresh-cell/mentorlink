import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=readFileSync(new URL("../app/_components/PublicMentorDirectory.tsx",import.meta.url),"utf8");
test("search is explicit and Enter submits the same form",()=>{assert.match(source,/role="search" onSubmit=\{submitSearch\}/);assert.match(source,/type="submit"/);assert.match(source,/>חיפוש<\/button>/);assert.match(source,/draftSearch/)});
test("filters, removable chips and clearing are available",()=>{assert.match(source,/label="עיר"/);assert.match(source,/label="תחום או מקצוע"/);assert.match(source,/label="אופן מפגש"/);assert.match(source,/מסננים פעילים/);assert.match(source,/ניקוי החיפוש/);assert.match(source,/ALL_OPTIONS/)});
test("results have titles empty state and incremental batches",()=>{assert.match(source,/INITIAL_BATCH = 8/);assert.match(source,/תוצאות החיפוש/);assert.match(source,/חונכים זמינים/);assert.match(source,/הצגת חונכים נוספים/);assert.match(source,/visible\.length < filtered\.length/);assert.match(source,/EmptyState/)});
test("query parameters restore state and browser history",()=>{for(const parameter of ["q","city","subject","mode"])assert.match(source,new RegExp(`get\\(\\"${parameter}\\"\\)`));assert.match(source,/useSearchParams/);assert.match(source,/router\.push/)});