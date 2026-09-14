import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const RESOURCE_ID = "8f714b6f-c35c-4b40-a0e7-547b675eee0e";
const API = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=5000`;
const OUT = resolve("supabase/migrations/202609140048_seed_official_israel_localities.sql");

const response = await fetch(API, { headers: { Accept: "application/json" } });
if (!response.ok) throw new Error(`data.gov.il returned ${response.status}`);
const payload = await response.json();
if (!payload?.success || !Array.isArray(payload?.result?.records)) throw new Error("Unexpected data.gov.il response");

const records = payload.result.records
  .map((row) => ({
    code: String(row.city_code ?? "").trim(),
    name: String(row.city_name_he ?? "").trim(),
    region: String(row.region_name ?? "").trim(),
  }))
  .filter((row) => row.code && row.name);

if (records.length < 1000) throw new Error(`Expected official locality catalog, received only ${records.length} rows`);

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const normalize = (value) => value.replace(/[\u0591-\u05C7]/g, "").replace(/\s+/g, " ").trim();
const values = records.map((row) => `(${q(row.name)}, ${q(normalize(row.name))}, ${q(row.code)}, ${row.region ? q(row.region) : "null"}, true)`).join(",\n");

const sql = `-- Generated from the official Population and Immigration Authority locality catalog.\n-- Resource: ${RESOURCE_ID}\ninsert into public.israel_localities (name, normalized_name, city_code, region, is_active)\nvalues\n${values}\non conflict (name) do update set\n  normalized_name = excluded.normalized_name,\n  city_code = excluded.city_code,\n  region = excluded.region,\n  is_active = true,\n  updated_at = now();\n\nNOTIFY pgrst, 'reload schema';\n`;
await writeFile(OUT, sql, "utf8");
console.log(`Wrote ${records.length} official localities to ${OUT}`);

