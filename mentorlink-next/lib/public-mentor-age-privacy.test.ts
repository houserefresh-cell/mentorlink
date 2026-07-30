import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const core=readFileSync(new URL("../lib/public-mentor-core.ts",import.meta.url),"utf8");const loader=readFileSync(new URL("../lib/public-mentor-data.ts",import.meta.url),"utf8");
test("birth date is read only server-side and projected as numeric age",()=>{const publicType=core.match(/export type PublicMentor = \{[\s\S]*?\};/)?.[0]??"";assert.match(loader,/import "server-only"/);assert.match(loader,/bio, birth_date/);assert.match(core,/age: profile\.birth_date \? publicAgeFromBirthDate/);assert.match(publicType,/age\?: number \| null/);assert.doesNotMatch(publicType,/birth_date|birthDate/);assert.doesNotMatch(core,/birth_date: profile\.birth_date/)});