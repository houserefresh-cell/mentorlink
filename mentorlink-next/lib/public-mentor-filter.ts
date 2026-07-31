import type { PublicMentor } from "./public-mentor-core";
export const ALL_CITIES = "כל הערים";
export const ALL_SUBJECTS = "כל המקצועות והתחומים";
export const ALL_MODES = "כל אופני המפגש";
export const MIN_MENTOR_AGE = 10;
export const MAX_MENTOR_AGE = 80;
export const MEETING_MODES = ["פרונטלי", "אונליין"] as const;
export const REGIONAL_CITIES = ["הוד השרון","כפר סבא","רעננה","ירקונה","גני עם","עדנים","נווה ירק","אלישמע","נווה ימין","ירחיב","מתן","נירית","צור יצחק","צופית","שדה ורבורג","גן חיים","רמות השבים","כפר מל\"ל","גבעת חן","גבעת השלושה","עינת","שדה חמד","נחשונים","חגור"] as const;
export type MentorFilters={cities:string[];subjects:string[];meetingModes:string[];minAge:number|null;maxAge:number|null};
export function normalizeMentorSearch(value:string){return value.trim().replace(/\s+/g," ").toLocaleLowerCase("he")}
export function normalizeCity(value:string){return normalizeMentorSearch(value).replace(/^קיבוץ\s+/,"").replace(/[\s"״׳']/g,"")}
export function parseOptionalAge(value:string|null){if(value===null||value.trim()==="")return null;if(!/^\d+$/.test(value))return null;const age=Number(value);return Number.isInteger(age)&&age>=MIN_MENTOR_AGE&&age<=MAX_MENTOR_AGE?age:null}
export function validateAgeInputs(minimum:string,maximum:string){const invalid=(value:string)=>value!==""&&(!/^\d+$/.test(value)||Number(value)<MIN_MENTOR_AGE||Number(value)>MAX_MENTOR_AGE);if(invalid(minimum)||invalid(maximum))return "יש להזין גיל שלם בין 10 ל־80.";if(minimum&&maximum&&Number(minimum)>Number(maximum))return "הגיל המינימלי אינו יכול להיות גבוה מהגיל המקסימלי.";return null}
function list(value:string|string[]){return Array.isArray(value)?[...new Set(value)]:value?[value]:[]}
export function getOfferedSubjectOptions(mentors:PublicMentor[]){return [...new Set(mentors.flatMap((mentor)=>mentor.subjects).map((value)=>value.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"he"))}
export function filterPublicMentors(mentors:PublicMentor[],cities:string|string[],subjects:string|string[],meetingModes:string|string[],minimumAge:number|null=null,maximumAge:number|null=null){const selectedCities=list(cities).map(normalizeCity),selectedSubjects=list(subjects),selectedModes=list(meetingModes);return mentors.filter((mentor)=>(!selectedCities.length||selectedCities.includes(normalizeCity(mentor.city??"")))&&(!selectedSubjects.length||selectedSubjects.some((value)=>mentor.subjects.includes(value)))&&(!selectedModes.length||selectedModes.some((value)=>mentor.meetingModes.includes(value)))&&(minimumAge===null&&maximumAge===null||(typeof mentor.age==="number"&&(minimumAge===null||mentor.age>=minimumAge)&&(maximumAge===null||mentor.age<=maximumAge))))}