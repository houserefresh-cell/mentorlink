"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { getAgeFromBirthDate } from "../../../../lib/mentor-age";
import { MIN_MENTOR_REGISTRATION_AGE } from "../../../../lib/mentor-registration";
import {
  ChoicePills,
  Field,
  FormMessage,
  LoadingPage,
  MentorPageShell,
  SavePanel,
  inputClassName,
  toggleValue,
} from "../_components/MentorPageShell";
import WebPushControls from "../../_components/WebPushControls";

const AGE_GROUPS = [
  "א׳–ב׳",
  "ג׳–ד׳",
  "ה׳–ו׳",
  "חטיבת ביניים",
  "תיכון",
] as const;

const SCHOOLS = ["בית ספר יסודי", "חטיבת ביניים", "תיכון", "בית ספר אחר"] as const;
const PLACES = ["בבית התלמיד", "בבית החונך", "בבית הספר", "במרכז קהילתי", "אונליין"] as const;
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"] as const;
const TIME_PREFERENCES = ["בוקר", "צהריים", "אחר הצהריים", "ערב"] as const;
const EXPERIENCES = ["הדרכה", "תנועת נוער", "אימון ספורט", "עבודה עם ילדים"] as const;
const MENTORING_TYPES = ["לימודית", "חברתית", "ספורטיבית", "אישית", "עזרה בשיעורי בית"] as const;
const AGES = ["א׳–ב׳", "ג׳–ד׳", "ה׳–ו׳", "חטיבת ביניים", "תיכון"] as const;
const MODES = ["פרונטלי", "אונליין"] as const;
const FORMATS = ["מפגש אישי", "קבוצה קטנה"] as const;

type StepKey = "profile" | "subjects" | "locations" | "availability" | "experience" | "photo" | "summary";

type SubjectOption = { id: number; name: string; category: string };
type MentorSubject = { subject_id: number; age_groups: string[]; custom_subject: string | null };

type TimeRange = { start: string; end: string };
type Schedule = Record<string, TimeRange[]>;

const STEP_META: Array<{ key: StepKey; title: string; description: string }> = [
  { key: "profile", title: "פרטים אישיים", description: "שם, תאריך לידה, בית ספר, שפות ותיאור קצר." },
  { key: "subjects", title: "תחומי חונכות", description: "בחרו את התחומים ושכבות הגיל המתאימות." },
  { key: "experience", title: "ניסיון ויכולת", description: "שלושה פרטים קצרים שיעזרו לנו להכיר אתכם." },
  { key: "availability", title: "זמינות · לא חובה", description: "אפשר לדלג ולפרסם זמינות בהמשך." },
  { key: "locations", title: "בתי ספר ואזור פעילות · לא חובה", description: "אפשר לדלג ולחזור להגדרת האזורים בהמשך." },
  { key: "photo", title: "תמונת פרופיל · לא חובה", description: "אפשר להעלות תמונה ברורה ואמינה למשפחות, או להמשיך בלעדיה." },
  { key: "summary", title: "סיכום ואישור", description: "בדקו את הפרטים והשלימו את דרישות האישור לפני שליחה לבדיקת מנהל." },
];

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function MentorOnboardingPage() {
  const router = useRouter();

  const [activeStep, setActiveStep] = useState(0);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [consentStatus, setConsentStatus] = useState("missing");
  const [consentStatusLabel, setConsentStatusLabel] = useState("לא נשלחה בקשה");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [languages, setLanguages] = useState("");
  const [bio, setBio] = useState("");

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Record<number, string[]>>({});
  const [customSubject, setCustomSubject] = useState("");

  const [locationsSchools, setLocationsSchools] = useState<string[]>([]);
  const [customSchool, setCustomSchool] = useState("");
  const [activityAreas, setActivityAreas] = useState("");
  const [meetingPlaces, setMeetingPlaces] = useState<string[]>([]);

  const [schedule, setSchedule] = useState<Schedule>({});
  const [flexible, setFlexible] = useState(false);
  const [holidays, setHolidays] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [oneTime, setOneTime] = useState(false);
  const [timePreferences, setTimePreferences] = useState<string[]>([]);

  const [hasPrevious, setHasPrevious] = useState(false);
  const [details, setDetails] = useState("");
  const [experienceTypes, setExperienceTypes] = useState<string[]>([]);
  const [courses, setCourses] = useState("");
  const [strengths, setStrengths] = useState("");
  const [values, setValues] = useState("");
  const [motivation, setMotivation] = useState("");
  const [mentoringTypes, setMentoringTypes] = useState<string[]>([]);

  const [preferredAges, setPreferredAges] = useState<string[]>([]);
  const [preferredGender, setPreferredGender] = useState("אין העדפה");
  const [distance, setDistance] = useState("10");
  const [meetingModes, setMeetingModes] = useState<string[]>([]);
  const [sessionFormats, setSessionFormats] = useState<string[]>([]);
  const [meetingsPerWeek, setMeetingsPerWeek] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [specialNeeds, setSpecialNeeds] = useState(false);
  const [matchingInfo, setMatchingInfo] = useState("");

  const [storedPhotoPath, setStoredPhotoPath] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const subjectGroups = useMemo(() => subjects.reduce<Record<string, SubjectOption[]>>((groups, subject) => {
    (groups[subject.category] ??= []).push(subject);
    return groups;
  }, {}), [subjects]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("step") === "summary") {
      setActiveStep(6);
    }
  }, []);

  const requiredProfileChecks = useMemo(() => [
      Boolean(firstName.trim() && lastName.trim() && birthDate),
      Object.keys(selectedSubjects).length > 0,
      Boolean(values.trim() && motivation.trim() && mentoringTypes.length > 0),
    ], [birthDate, firstName, lastName, motivation, mentoringTypes.length, selectedSubjects, values]);

  const profileDetailsComplete = requiredProfileChecks.every(Boolean);
  const parentConsentComplete = isMinor !== true || consentStatus === "approved";
  const readyForReview = profileDetailsComplete && emailConfirmed && parentConsentComplete;

  const progressPercent = useMemo(() => {
    const requirements = [...requiredProfileChecks, emailConfirmed];
    if (isMinor === true) requirements.push(consentStatus === "approved");
    return Math.round((requirements.filter(Boolean).length / requirements.length) * 100);
  }, [consentStatus, emailConfirmed, isMinor, requiredProfileChecks]);

  function continueAfterPhoto() {
    setMessage(null);
    if (isMinor === true && consentStatus !== "approved") {
      router.push("/dashboard/mentor/parent-consent");
      return;
    }
    setActiveStep(6);
  }

  function getConsentStatusLabel(status: string, minor: boolean | null) {
    if (minor === false) return "לא נדרש";
    switch (status) {
      case "approved":
        return "אושר";
      case "sent":
        return "ממתין לאישור הורה";
      case "declined":
        return "נדחה";
      case "expired":
        return "פג תוקף";
      case "missing":
      default:
        return "לא נשלחה בקשה";
    }
  }

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      setUserId(auth.user.id);
      setEmailConfirmed(Boolean(auth.user.email_confirmed_at));

      const [profileResult, subjectsResult, choicesResult, availabilityResult, locationsResult, experienceResult, preferencesResult, consentResult] = await Promise.all([
        supabase
          .from("mentor_profiles")
          .select("first_name, last_name, birth_date, grade, school, city, phone, languages, bio, profile_photo_path")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
        supabase.from("subjects").select("id, name, category").order("category").order("name"),
        supabase.from("mentor_subjects").select("subject_id, age_groups, custom_subject").eq("user_id", auth.user.id),
        supabase.from("mentor_availability").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_locations").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_experience").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_preferences").select("*").eq("user_id", auth.user.id).maybeSingle(),
        supabase.from("mentor_parent_consents").select("status").eq("user_id", auth.user.id).maybeSingle(),
      ]);

      if (profileResult.data) {
        const profile = profileResult.data as Record<string, unknown>;
        setFirstName(String(profile.first_name ?? auth.user.user_metadata?.first_name ?? ""));
        setLastName(String(profile.last_name ?? auth.user.user_metadata?.last_name ?? ""));
        setBirthDate(String(profile.birth_date ?? ""));
        setGrade(String(profile.grade ?? ""));
        setSchool(String(profile.school ?? ""));
        setCity(String(profile.city ?? ""));
        setPhone(String(profile.phone ?? ""));
        setLanguages(Array.isArray(profile.languages) ? profile.languages.join(", ") : String(profile.languages ?? ""));
        setBio(String(profile.bio ?? ""));
        const path = profile.profile_photo_path as string | undefined;
        setStoredPhotoPath(path ?? "");
        if (path) {
          const { data: signed } = await supabase.storage.from("mentor-profile-photos").createSignedUrl(path, 3600);
          setPhotoPreviewUrl(signed?.signedUrl ?? "");
        }
      } else {
        setFirstName(String(auth.user.user_metadata?.first_name ?? ""));
        setLastName(String(auth.user.user_metadata?.last_name ?? ""));
      }

      setSubjects((subjectsResult.data ?? []) as SubjectOption[]);
      const savedChoices = (choicesResult.data ?? []) as MentorSubject[];
      setSelectedSubjects(
        savedChoices.reduce<Record<number, string[]>>((result, choice) => {
          result[choice.subject_id] = choice.age_groups;
          return result;
        }, {}),
      );
      const otherSubject = (subjectsResult.data ?? []).find((subject) => subject.name === "אחר");
      const savedOtherChoice = otherSubject ? savedChoices.find((choice) => choice.subject_id === otherSubject.id) : undefined;
      setCustomSubject(savedOtherChoice?.custom_subject ?? "");

      if (availabilityResult.data) {
        setSchedule((availabilityResult.data.weekly_schedule as Schedule) ?? {});
        setFlexible(Boolean(availabilityResult.data.flexible_availability));
        setHolidays(Boolean(availabilityResult.data.available_on_holidays));
        setRecurring(Boolean(availabilityResult.data.recurring_meetings));
        setOneTime(Boolean(availabilityResult.data.one_time_meetings));
        setTimePreferences((availabilityResult.data.time_preferences as string[]) ?? []);
      }

      if (locationsResult.data) {
        setCity((currentCity) => String(locationsResult.data.city ?? currentCity));
        setActivityAreas((locationsResult.data.activity_areas as string[] | undefined)?.join(", ") ?? "");
        setLocationsSchools((locationsResult.data.preferred_schools as string[]) ?? []);
        setCustomSchool(String(locationsResult.data.custom_school ?? ""));
        setMeetingPlaces((locationsResult.data.meeting_places as string[]) ?? []);
      }

      if (experienceResult.data) {
        setHasPrevious(Boolean(experienceResult.data.has_previous_mentoring));
        setDetails(String(experienceResult.data.previous_mentoring_details ?? ""));
        setExperienceTypes((experienceResult.data.experience_types as string[]) ?? []);
        setCourses(String(experienceResult.data.courses_and_certificates ?? ""));
        setStrengths(((experienceResult.data.strengths as string[]) ?? []).join(", "));
        setValues(String(experienceResult.data.relationship_values ?? ""));
        setMotivation(String(experienceResult.data.motivation ?? ""));
        setMentoringTypes((experienceResult.data.mentoring_types as string[]) ?? []);
      }

      if (preferencesResult.data) {
        setPreferredAges((preferencesResult.data.preferred_age_groups as string[]) ?? []);
        setPreferredGender(String(preferencesResult.data.preferred_gender ?? "אין העדפה"));
        setDistance(String(preferencesResult.data.max_travel_distance_km ?? 10));
        setMeetingModes((preferencesResult.data.meeting_modes as string[]) ?? []);
        setSessionFormats((preferencesResult.data.session_formats as string[]) ?? []);
        setMeetingsPerWeek(String(preferencesResult.data.preferred_meetings_per_week ?? 1));
        setDurationMinutes(String(preferencesResult.data.preferred_session_duration_minutes ?? 60));
        setSpecialNeeds(Boolean(preferencesResult.data.willing_special_needs));
        setMatchingInfo(String(preferencesResult.data.additional_matching_info ?? ""));
      }

      const age = profileResult.data?.birth_date ? getAgeFromBirthDate(String(profileResult.data.birth_date)) : null;
      const minor = age === null ? null : age < 18;
      setIsMinor(minor);
      const status = (consentResult.data?.status as string | undefined) ?? "missing";
      setConsentStatus(status);
      setConsentStatusLabel(getConsentStatusLabel(status, minor));
      setLoading(false);
    }

    load();
  }, [router]);

  function updateDayEnabled(day: string, enabled: boolean) {
    setSchedule((current) => {
      const next = { ...current };
      if (enabled) {
        next[day] = [{ start: "16:00", end: "18:00" }];
      } else {
        delete next[day];
      }
      return next;
    });
  }

  function updateRange(day: string, index: number, field: keyof TimeRange, value: string) {
    setSchedule((current) => ({
      ...current,
      [day]: current[day].map((range, i) => (i === index ? { ...range, [field]: value } : range)),
    }));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedLanguages = languages.split(",").map((entry) => entry.trim()).filter(Boolean);

    if (!trimmedFirstName || !trimmedLastName) {
      setMessage({ type: "error", text: "יש למלא שם פרטי ושם משפחה." });
      return;
    }

    if (!birthDate) {
      setMessage({ type: "error", text: "יש להזין תאריך לידה." });
      return;
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      setMessage({ type: "error", text: "תאריך הלידה אינו תקין." });
      return;
    }

    if (parsedBirthDate > new Date()) {
      setMessage({ type: "error", text: "תאריך הלידה לא יכול להיות בעתיד." });
      return;
    }

    const age = getAgeFromBirthDate(birthDate);
    if (age === null || age > 100) {
      setMessage({ type: "error", text: "יש להזין תאריך לידה תקין לחונך/ת." });
      return;
    }
    if (age < MIN_MENTOR_REGISTRATION_AGE) {
      setMessage({ type: "error", text: `ההרשמה כחונך אפשרית מגיל ${MIN_MENTOR_REGISTRATION_AGE} בלבד.` });
      return;
    }

    if (trimmedLanguages.length === 0) {
      setMessage({ type: "error", text: "יש להזין לפחות שפה אחת." });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("mentor_profiles").upsert(
      {
        user_id: userId,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        birth_date: birthDate,
        grade: grade.trim(),
        school: school.trim(),
        city: city.trim(),
        phone: phone.trim(),
        languages: trimmedLanguages,
        bio: bio.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setMessage({ type: "error", text: `לא ניתן לשמור את הפרטים האישיים: ${error.message}` });
      setSaving(false);
      return;
    }

    await supabase.auth.updateUser({ data: { first_name: trimmedFirstName, last_name: trimmedLastName } });
    const minor = age < 18;
    setIsMinor(minor);
    setConsentStatusLabel(getConsentStatusLabel(consentStatus, minor));
    setMessage({ type: "success", text: "הפרטים האישיים נשמרו בהצלחה." });
    setSaving(false);
    setActiveStep(1);
  }

  async function saveSubjects(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const selectedSubjectIds = Object.keys(selectedSubjects).map(Number);
    if (selectedSubjectIds.length === 0) {
      setMessage({ type: "error", text: "יש לבחור לפחות תחום חונכות אחד." });
      return;
    }

    const subjectWithoutAgeGroup = selectedSubjectIds.find((subjectId) => selectedSubjects[subjectId].length === 0);
    if (subjectWithoutAgeGroup) {
      const subjectName = subjects.find((subject) => subject.id === subjectWithoutAgeGroup)?.name ?? "תחום";
      setMessage({ type: "error", text: `יש לבחור לפחות שכבת גיל אחת עבור ${subjectName}.` });
      return;
    }

    const otherSubject = subjects.find((subject) => subject.name === "אחר");
    const otherIsSelected = otherSubject !== undefined && selectedSubjects[otherSubject.id] !== undefined;
    if (otherIsSelected && !customSubject.trim()) {
      setMessage({ type: "error", text: "יש לפרט את התחום האחר." });
      return;
    }

    setSaving(true);
    const rows = selectedSubjectIds.map((subjectId) => ({
      user_id: userId,
      subject_id: subjectId,
      age_groups: selectedSubjects[subjectId],
      custom_subject: subjectId === otherSubject?.id ? customSubject.trim() : null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase.from("mentor_subjects").upsert(rows, { onConflict: "user_id,subject_id" });
    if (upsertError) {
      setMessage({ type: "error", text: `לא ניתן לשמור את תחומי החונכות: ${upsertError.message}` });
      setSaving(false);
      return;
    }

    const { data: savedChoices, error: loadError } = await supabase.from("mentor_subjects").select("subject_id").eq("user_id", userId);
    if (loadError) {
      setSaving(false);
      setMessage({ type: "error", text: `הבחירות נשמרו, אך לא ניתן היה לסיים את הסנכרון: ${loadError.message}` });
      return;
    }

    const removedSubjectIds = (savedChoices ?? []).map((choice) => choice.subject_id as number).filter((subjectId) => !selectedSubjectIds.includes(subjectId));
    if (removedSubjectIds.length > 0) {
      const { error: deleteError } = await supabase.from("mentor_subjects").delete().eq("user_id", userId).in("subject_id", removedSubjectIds);
      if (deleteError) {
        setMessage({ type: "error", text: `הבחירות נשמרו, אך לא ניתן למחוק תחומים שהוסרו: ${deleteError.message}` });
        setSaving(false);
        return;
      }
    }

    setMessage({ type: "success", text: "תחומי החונכות נשמרו בהצלחה." });
    setSaving(false);
    setActiveStep(2);
  }

  async function saveLocations(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (locationsSchools.includes("בית ספר אחר") && !customSchool.trim()) {
      setMessage({ type: "error", text: "יש לפרט את שם בית הספר האחר." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("mentor_locations").upsert({
      user_id: userId,
      city: city.trim(),
      activity_areas: activityAreas.split(",").map((value) => value.trim()).filter(Boolean),
      preferred_schools: locationsSchools,
      custom_school: locationsSchools.includes("בית ספר אחר") ? customSchool.trim() : null,
      meeting_places: meetingPlaces,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      setMessage({ type: "error", text: `לא ניתן לשמור את אזורי הפעילות: ${error.message}` });
      setSaving(false);
      return;
    }

    setMessage({ type: "success", text: "אזורי הפעילות נשמרו בהצלחה." });
    setSaving(false);
    setActiveStep(5);
  }

  async function saveAvailability(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const invalid = Object.values(schedule).flat().some((range) => range.end <= range.start);
    if (invalid) {
      setMessage({ type: "error", text: "שעת הסיום חייבת להיות מאוחרת משעת ההתחלה." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("mentor_availability").upsert({
      user_id: userId,
      weekly_schedule: schedule,
      flexible_availability: flexible,
      available_on_holidays: holidays,
      recurring_meetings: recurring,
      one_time_meetings: oneTime,
      time_preferences: timePreferences,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      setMessage({ type: "error", text: `לא ניתן לשמור את הזמינות: ${error.message}` });
      setSaving(false);
      return;
    }

    setMessage({ type: "success", text: "הזמינות נשמרה בהצלחה." });
    setSaving(false);
    setActiveStep(4);
  }

  async function saveExperience(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!mentoringTypes.length) {
      setMessage({ type: "error", text: "יש לבחור לפחות סוג חונכות אחד." });
      return;
    }

    if (!motivation.trim() || !values.trim()) {
      setMessage({ type: "error", text: "יש למלא את הסיבה להיות חונך/ת ואת הערכים בעבודה עם החניך/ה." });
      return;
    }

    setSaving(true);
    const profileUpdate = supabase.from("mentor_profiles").update({ bio: bio.trim(), updated_at: new Date().toISOString() }).eq("user_id", userId);
    const experienceUpsert = supabase.from("mentor_experience").upsert({
      user_id: userId,
      has_previous_mentoring: hasPrevious,
      previous_mentoring_details: hasPrevious ? details.trim() : null,
      experience_types: experienceTypes,
      courses_and_certificates: courses.trim() || null,
      strengths: strengths.split(",").map((value) => value.trim()).filter(Boolean),
      relationship_values: values.trim(),
      motivation: motivation.trim(),
      mentoring_types: mentoringTypes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    const preferencesUpsert = supabase.from("mentor_preferences").upsert({
      user_id: userId,
      preferred_age_groups: preferredAges,
      preferred_gender: preferredGender,
      max_travel_distance_km: Number(distance),
      meeting_modes: meetingModes,
      session_formats: sessionFormats,
      preferred_meetings_per_week: Number(meetingsPerWeek),
      preferred_session_duration_minutes: Number(durationMinutes),
      willing_special_needs: specialNeeds,
      additional_matching_info: matchingInfo.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const [profileResult, experienceResult, preferencesResult] = await Promise.all([profileUpdate, experienceUpsert, preferencesUpsert]);
    if (profileResult.error || experienceResult.error || preferencesResult.error) {
      const error = profileResult.error ?? experienceResult.error ?? preferencesResult.error;
      setMessage({ type: "error", text: `לא ניתן לשמור את הניסיון וההצגה העצמית: ${error?.message}` });
      setSaving(false);
      return;
    }

    setMessage({ type: "success", text: "הניסיון וההצגה העצמית נשמרו בהצלחה." });
    setSaving(false);
    setActiveStep(3);
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "ניתן להעלות רק JPG, PNG או WEBP." });
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setMessage({ type: "error", text: "גודל התמונה המרבי הוא 5MB." });
      return;
    }

    setPhotoBusy(true);
    setMessage(null);

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/profile.${extension}`;

    if (storedPhotoPath && storedPhotoPath !== path) {
      await supabase.storage.from("mentor-profile-photos").remove([storedPhotoPath]);
    }

    const { error: uploadError } = await supabase.storage.from("mentor-profile-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setMessage({ type: "error", text: `שגיאה בהעלאת התמונה: ${uploadError.message}` });
      setPhotoBusy(false);
      return;
    }

    const { error: profileError } = await supabase.from("mentor_profiles").update({ profile_photo_path: path, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (profileError) {
      setMessage({ type: "error", text: `התמונה הועלתה, אך לא נקשרה לפרופיל: ${profileError.message}` });
      setPhotoBusy(false);
      return;
    }

    const { data } = await supabase.storage.from("mentor-profile-photos").createSignedUrl(path, 3600);
    setStoredPhotoPath(path);
    setPhotoPreviewUrl(data?.signedUrl ?? "");
    setMessage({ type: "success", text: "תמונת הפרופיל נשמרה בהצלחה." });
    setPhotoBusy(false);
    continueAfterPhoto();
  }

  async function removePhoto() {
    if (!storedPhotoPath) return;
    setPhotoBusy(true);
    const { error: storageError } = await supabase.storage.from("mentor-profile-photos").remove([storedPhotoPath]);
    if (storageError) {
      setMessage({ type: "error", text: `שגיאה במחיקת התמונה: ${storageError.message}` });
      setPhotoBusy(false);
      return;
    }
    const { error } = await supabase.from("mentor_profiles").update({ profile_photo_path: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) {
      setMessage({ type: "error", text: `שגיאה בעדכון הפרופיל: ${error.message}` });
      setPhotoBusy(false);
      return;
    }
    setStoredPhotoPath("");
    setPhotoPreviewUrl("");
    setMessage({ type: "success", text: "התמונה הוסרה." });
    setPhotoBusy(false);
  }

  async function submitForReview(event?: FormEvent) {
    event?.preventDefault();
    setMessage(null);

    if (!emailConfirmed) {
      setMessage({ type: "error", text: "כתובת האימייל טרם אומתה. יש לפתוח את הודעת האימות שנשלחה אליכם לפני שליחת הפרופיל לבדיקה." });
      return;
    }

    if (!profileDetailsComplete) {
      setMessage({ type: "error", text: "יש להשלים את כל שלבי החובה לפני שליחה לאישור." });
      return;
    }

    if (isMinor && consentStatus !== "approved") {
      setMessage({ type: "error", text: "לא ניתן לשלוח פרופיל של חונך קטין ללא אישור הורה מאומת." });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("mentor_publication").upsert({
      user_id: userId,
      status: "pending_review",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      setMessage({ type: "error", text: "לא ניתן לשלוח את הפרופיל. לחונך שטרם מלאו לו 18 נדרש אישור הורה מאומת." });
      setSubmitting(false);
      return;
    }

    setMessage({ type: "success", text: "הפרופיל נשלח לאישור בהצלחה." });
    setAutoSubmitted(true);
    setSubmitting(false);
  }

  useEffect(() => {
    if (activeStep === 6 && readyForReview && !autoSubmitted && !submitting) {
      setAutoSubmitted(true);
      void submitForReview();
    }
  }, [activeStep, autoSubmitted, readyForReview, submitting]);

  if (loading) {
    return <LoadingPage text="מכין את מסע ההרשמה..." />;
  }

  const step = STEP_META[activeStep];

  return (
    <MentorPageShell eyebrow="מסע הרשמה" title="השלמת פרופיל לחונך" description="הזינו את הפרטים בשבעה שלבים קצרים, מכל מכשיר, והמידע ישמר אוטומטית.">
      <div className={`mb-5 rounded-2xl border p-4 font-bold ${emailConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        {emailConfirmed ? "כתובת האימייל אומתה בהצלחה." : "כתובת האימייל טרם אומתה. ניתן להשלים פרטים, אך לא לשלוח את הפרופיל לבדיקת מנהל."}
      </div>
      <div className="mb-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-blue-700">התקדמות</p>
            <h2 className="text-2xl font-extrabold">{step.title}</h2>
          </div>
          <div className={`rounded-full px-4 py-2 text-sm font-bold ${readyForReview ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
            {readyForReview ? "כל הדרישות הושלמו" : `${progressPercent}% הושלם`}
          </div>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-4 text-slate-600">{step.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {STEP_META.map((item, index) => {
            const active = index === activeStep;
            const done = index < activeStep;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`rounded-full px-3 py-2 text-sm font-bold transition ${active ? "bg-blue-600 text-white" : done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
              >
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-8">
        {activeStep === 0 && (
          <form onSubmit={saveProfile} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="שם פרטי" htmlFor="firstName" required><input id="firstName" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClassName} /></Field>
              <Field label="שם משפחה" htmlFor="lastName" required><input id="lastName" required value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClassName} /></Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="תאריך לידה" htmlFor="birthDate" required><input id="birthDate" type="date" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className={inputClassName} /></Field>
              <Field label="כיתה / מסגרת" htmlFor="grade"><input id="grade" value={grade} onChange={(event) => setGrade(event.target.value)} className={inputClassName} /></Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="בית ספר" htmlFor="school"><input id="school" value={school} onChange={(event) => setSchool(event.target.value)} className={inputClassName} /></Field>
              <Field label="עיר" htmlFor="city" required><input id="city" required value={city} onChange={(event) => setCity(event.target.value)} className={inputClassName} /></Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="טלפון" htmlFor="phone"><input id="phone" type="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} className={`${inputClassName} text-left`} /></Field>
              <Field label="שפות" htmlFor="languages" required><input id="languages" required value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="למשל: עברית, אנגלית" className={inputClassName} /></Field>
            </div>
            <Field label="קצת עליי" htmlFor="bio" required><textarea id="bio" required rows={4} value={bio} onChange={(event) => setBio(event.target.value)} className={inputClassName} /></Field>
            <SavePanel saving={saving} message={message} label="שמירה והמשך" />
          </form>
        )}

        {activeStep === 1 && (
          <form onSubmit={saveSubjects} className="space-y-6">
            <p className="font-bold text-slate-800">בחרו לפחות תחום אחד <span className="text-red-600" aria-hidden="true">*</span>. אפשר לבחור יותר מתשובה אחת.</p>
            <div className="space-y-6">
              {Object.entries(subjectGroups).map(([category, categorySubjects]) => <section key={category} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <h3 className="mb-4 text-xl font-black text-blue-900">{category}</h3>
                <div className="grid gap-4 lg:grid-cols-2">{categorySubjects.map((subject) => {
                const isSelected = selectedSubjects[subject.id] !== undefined;
                return (
                  <fieldset key={subject.id} className={`rounded-2xl border bg-white p-5 ${isSelected ? "border-blue-400 ring-4 ring-blue-50" : "border-slate-200"}`}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => setSelectedSubjects((current) => {
                        if (current[subject.id]) {
                          const next = { ...current };
                          delete next[subject.id];
                          return next;
                        }
                        return { ...current, [subject.id]: [] };
                      })} className="h-5 w-5 accent-blue-600" />
                      <span className="text-lg font-extrabold">{subject.name}</span>
                    </label>
                    {isSelected && (
                      <div className="mt-5 border-t border-slate-100 pt-5">
                        {subject.name === "אחר" && <Field label="מהו התחום?" htmlFor="customSubject" required><input id="customSubject" value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} required className={inputClassName} /></Field>}
                        <p className="mb-3 font-bold">שכבות גיל <span className="text-red-600" aria-hidden="true">*</span></p>
                        <ChoicePills options={[...AGE_GROUPS]} selected={selectedSubjects[subject.id] ?? []} onToggle={(value) => setSelectedSubjects((current) => ({ ...current, [subject.id]: toggleValue(current[subject.id] ?? [], value) }))} />
                      </div>
                    )}
                  </fieldset>
                );
              })}</div></section>)}
            </div>
            <SavePanel saving={saving} message={message} label="שמירה והמשך" />
          </form>
        )}

        {activeStep === 4 && (
          <form onSubmit={saveLocations} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="עיר" htmlFor="locationCity"><input id="locationCity" value={city} onChange={(event) => setCity(event.target.value)} className={inputClassName} /></Field>
              <Field label="שכונות או אזורים" htmlFor="activityAreas"><input id="activityAreas" value={activityAreas} onChange={(event) => setActivityAreas(event.target.value)} placeholder="הפרדה בפסיקים" className={inputClassName} /></Field>
            </div>
            <div>
              <h3 className="mb-3 font-bold">בתי ספר מועדפים <span className="font-normal text-slate-500">(לא חובה; אפשר לבחור יותר מתשובה אחת)</span></h3>
              <ChoicePills options={[...SCHOOLS]} selected={locationsSchools} onToggle={(value) => setLocationsSchools(toggleValue(locationsSchools, value))} />
            </div>
            {locationsSchools.includes("בית ספר אחר") && <Field label="שם בית הספר האחר" htmlFor="customSchool" required><input id="customSchool" required value={customSchool} onChange={(event) => setCustomSchool(event.target.value)} className={inputClassName} /></Field>}
            <div>
              <h3 className="mb-3 font-bold">מקומות מפגש <span className="font-normal text-slate-500">(לא חובה; אפשר לבחור יותר מתשובה אחת)</span></h3>
              <ChoicePills options={[...PLACES]} selected={meetingPlaces} onToggle={(value) => setMeetingPlaces(toggleValue(meetingPlaces, value))} />
            </div>
            <SavePanel saving={saving} message={message} label="שמירה והמשך" />
          </form>
        )}

        {activeStep === 3 && (
          <form onSubmit={saveAvailability} className="space-y-6">
            <p className="font-bold text-slate-800">שלב זה אינו חובה. אפשר להוסיף זמינות עכשיו או בהמשך.</p>
            <div className="space-y-4">
              {DAYS.map((day) => {
                const ranges = schedule[day];
                return (
                  <section key={day} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <label className="flex items-center gap-3 text-lg font-extrabold">
                      <input type="checkbox" checked={Boolean(ranges)} onChange={(event) => updateDayEnabled(day, event.target.checked)} className="h-5 w-5 accent-blue-600" />
                      יום {day}
                    </label>
                    {ranges && (
                      <div className="mt-4 space-y-3">
                        {ranges.map((range, index) => (
                          <div key={`${day}-${index}`} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <Field label="התחלה" required><input type="time" value={range.start} onChange={(event) => updateRange(day, index, "start", event.target.value)} required className={inputClassName} /></Field>
                            <Field label="סיום" required><input type="time" value={range.end} onChange={(event) => updateRange(day, index, "end", event.target.value)} required className={inputClassName} /></Field>
                            <button type="button" onClick={() => setSchedule((current) => ({ ...current, [day]: current[day].filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700">מחיקה</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setSchedule((current) => ({ ...current, [day]: [...current[day], { start: "18:00", end: "20:00" }] }))} className="font-bold text-blue-600">+ הוספת טווח שעות</button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="mb-4 font-bold">אפשרויות כלליות</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" checked={flexible} onChange={(event) => setFlexible(event.target.checked)} className="h-5 w-5 accent-blue-600" />זמינות גמישה</label>
                <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" checked={holidays} onChange={(event) => setHolidays(event.target.checked)} className="h-5 w-5 accent-blue-600" />זמין בחופשות</label>
                <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} className="h-5 w-5 accent-blue-600" />זמין למפגש קבוע</label>
                <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" checked={oneTime} onChange={(event) => setOneTime(event.target.checked)} className="h-5 w-5 accent-blue-600" />זמין למפגש חד־פעמי</label>
              </div>
              <h4 className="mb-3 mt-6 font-bold">שעות מועדפות</h4>
              <ChoicePills options={[...TIME_PREFERENCES]} selected={timePreferences} onToggle={(value) => setTimePreferences(toggleValue(timePreferences, value))} />
            </section>
            <SavePanel saving={saving} message={message} label="שמירה והמשך" />
          </form>
        )}

        {activeStep === 2 && (
          <form onSubmit={saveExperience} className="space-y-6">
            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-black">ניסיון ופרטים נוספים <span className="font-normal text-slate-500">(לא חובה)</span></summary>
              <div className="mt-5 space-y-5">
            <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold">
              <input type="checkbox" checked={hasPrevious} onChange={(event) => setHasPrevious(event.target.checked)} className="h-5 w-5 accent-blue-600" />
              יש לי ניסיון קודם בחונכות
            </label>
            {hasPrevious && <Field label="פירוט ניסיון קודם" htmlFor="details"><textarea id="details" rows={4} value={details} onChange={(event) => setDetails(event.target.value)} className={inputClassName} /></Field>}
            <Field label="תיאור קצר עליי" htmlFor="bio"><textarea id="bio" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} className={inputClassName} /></Field>
            <div>
              <h3 className="mb-3 font-bold">תחומי ניסיון נוספים</h3>
              <ChoicePills options={[...EXPERIENCES]} selected={experienceTypes} onToggle={(value) => setExperienceTypes(toggleValue(experienceTypes, value))} />
            </div>
            <Field label="קורסים / תעודות" htmlFor="courses"><textarea id="courses" rows={3} value={courses} onChange={(event) => setCourses(event.target.value)} className={inputClassName} /></Field>
            <Field label="תחומי חוזקה" htmlFor="strengths"><input id="strengths" value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="הפרדה בפסיקים" className={inputClassName} /></Field>
              </div>
            </details>
            <Field label="מה חשוב לי בקשר עם החניך" htmlFor="values" required><textarea id="values" required rows={4} value={values} onChange={(event) => setValues(event.target.value)} className={inputClassName} /></Field>
            <Field label="מדוע אני רוצה להיות חונך/ת" htmlFor="motivation" required><textarea id="motivation" required rows={4} value={motivation} onChange={(event) => setMotivation(event.target.value)} className={inputClassName} /></Field>
            <div>
              <h3 className="mb-3 font-bold">סוגי חונכות <span className="text-red-600" aria-hidden="true">*</span> <span className="font-normal text-slate-500">(אפשר לבחור יותר מתשובה אחת)</span></h3>
              <ChoicePills options={[...MENTORING_TYPES]} selected={mentoringTypes} onToggle={(value) => setMentoringTypes(toggleValue(mentoringTypes, value))} />
            </div>
            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer font-black">העדפות התאמה <span className="font-normal text-slate-500">(לא חובה)</span></summary>
              <div className="mt-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 font-bold">שכבות גיל <span className="font-normal text-slate-500">(לא חובה; אפשר לבחור יותר מתשובה אחת)</span></h4>
                  <ChoicePills options={[...AGES]} selected={preferredAges} onToggle={(value) => setPreferredAges(toggleValue(preferredAges, value))} />
                </div>
                <Field label="מגדר מועדף" htmlFor="preferredGender"><select id="preferredGender" value={preferredGender} onChange={(event) => setPreferredGender(event.target.value)} className={inputClassName}><option>אין העדפה</option><option>בן</option><option>בת</option></select></Field>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field label="מרחק נסיעה מרבי (ק״מ)" htmlFor="distance"><input id="distance" type="number" min="0" value={distance} onChange={(event) => setDistance(event.target.value)} className={inputClassName} /></Field>
                <Field label="מפגשים בשבוע" htmlFor="meetingsPerWeek"><input id="meetingsPerWeek" type="number" min="1" value={meetingsPerWeek} onChange={(event) => setMeetingsPerWeek(event.target.value)} className={inputClassName} /></Field>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 font-bold">אופן המפגש <span className="font-normal text-slate-500">(לא חובה; אפשר לבחור יותר מתשובה אחת)</span></h4>
                  <ChoicePills options={[...MODES]} selected={meetingModes} onToggle={(value) => setMeetingModes(toggleValue(meetingModes, value))} />
                </div>
                <div>
                  <h4 className="mb-3 font-bold">מבנה המפגש <span className="font-normal text-slate-500">(לא חובה; אפשר לבחור יותר מתשובה אחת)</span></h4>
                  <ChoicePills options={[...FORMATS]} selected={sessionFormats} onToggle={(value) => setSessionFormats(toggleValue(sessionFormats, value))} />
                </div>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field label="משך מפגש (דקות)" htmlFor="durationMinutes"><input id="durationMinutes" type="number" min="15" step="15" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className={inputClassName} /></Field>
                <label className="flex items-center gap-3 rounded-xl bg-white p-4 font-bold"><input type="checkbox" checked={specialNeeds} onChange={(event) => setSpecialNeeds(event.target.checked)} className="h-5 w-5 accent-blue-600" />מוכן לחונכות עם צרכים מיוחדים</label>
              </div>
              <Field label="מידע נוסף להתאמה" htmlFor="matchingInfo"><textarea id="matchingInfo" rows={3} value={matchingInfo} onChange={(event) => setMatchingInfo(event.target.value)} className={inputClassName} /></Field>
              </div>
            </details>
            <SavePanel saving={saving} message={message} label="שמירה והמשך" />
          </form>
        )}

        {activeStep === 5 && (
          <div className="space-y-6">
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>תמונת פרופיל אינה חובה.</b> אפשר להעלות תמונה עכשיו או להמשיך בלעדיה ולעדכן אותה בהמשך.</p>
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 text-center">
              <div className="mx-auto mb-6 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-blue-200 bg-white">
                {photoPreviewUrl ? <Image src={photoPreviewUrl} alt="תצוגה מקדימה של תמונת הפרופיל" width={160} height={160} unoptimized className="h-full w-full object-cover" /> : <span className="text-center text-sm font-bold text-slate-500">טרם הועלתה תמונה</span>}
              </div>
              <label className="cursor-pointer rounded-xl bg-blue-600 px-6 py-3 font-bold text-white">
                {photoBusy ? "מעבד..." : storedPhotoPath ? "החלפת תמונה" : "העלאת תמונה"}
                <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={photoBusy} className="sr-only" />
              </label>
              {storedPhotoPath && <button type="button" onClick={removePhoto} disabled={photoBusy} className="ml-3 rounded-xl border border-red-200 px-6 py-3 font-bold text-red-700">הסרת תמונה</button>}
            </div>
            <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
              <button type="button" disabled={photoBusy} onClick={continueAfterPhoto} className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-400">{storedPhotoPath ? "שמירה והמשך" : "המשך ללא תמונה"}</button>
            </div>
          </div>
        )}

        {activeStep === 6 && (
          <form onSubmit={submitForReview} className="space-y-6">
            <div className="rounded-3xl border border-blue-100 bg-slate-50 p-6">
              <h3 className="text-xl font-extrabold">סיכום פרטי ההרשמה</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4"><p className="font-bold">שם</p><p>{firstName} {lastName}</p></div>
                <div className="rounded-2xl bg-white p-4"><p className="font-bold">סטטוס אישור הורה</p><p>{consentStatusLabel}</p></div>
                <div className="rounded-2xl bg-white p-4"><p className="font-bold">תחומים</p><p>{Object.keys(selectedSubjects).length > 0 ? Object.keys(selectedSubjects).length : "טרם נבחרו"}</p></div>
                <div className="rounded-2xl bg-white p-4"><p className="font-bold">זמינות</p><p>{Object.keys(schedule).length > 0 || flexible ? "הוגדרה" : "טרם הוגדרה"}</p></div>
              </div>
              <p className="mt-4 text-sm text-slate-600">המידע נשמר באופן מקומי ברשומה שלך ב-Supabase, והוא זמין לעריכה גם מהדשבורד בהמשך.</p>
            </div>

            {isMinor === true && (
              <div className={`rounded-3xl border p-6 ${consentStatus === "approved" ? "border-emerald-300 bg-emerald-50" : consentStatus === "declined" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
                <p className="text-sm font-bold text-slate-600">שלב חובה לחונך קטין</p>
                <h3 className="mt-1 text-xl font-extrabold">
                  {consentStatus === "approved" ? "אישור ההורה התקבל" : consentStatus === "sent" ? "ממתינים לאישור ההורה" : consentStatus === "declined" ? "בקשת אישור ההורה נדחתה" : "נדרש אישור הורה"}
                </h3>
                <p className="mt-2 text-slate-700">
                  {consentStatus === "approved"
                    ? "אישור ההורה התקבל והפרופיל נשלח אוטומטית לאישור מנהל."
                    : consentStatus === "sent"
                      ? "הבקשה נשלחה. אפשר לבדוק את הסטטוס או לשלוח בקשה חדשה מעמוד אישור ההורה."
                      : "כדי להשלים את ההרשמה יש להזין את פרטי ההורה ולשלוח אליו בקשת אישור."}
                </p>
                {consentStatus !== "approved" && (
                  <Link href="/dashboard/mentor/parent-consent" className="mt-4 inline-flex rounded-xl bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700">
                    {consentStatus === "sent" ? "בדיקת סטטוס אישור ההורה" : "מילוי פרטי ההורה ושליחת בקשה"}
                  </Link>
                )}
              </div>
            )}

            {!emailConfirmed && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">
                לפני השליחה יש לאמת את כתובת האימייל דרך ההודעה שנשלחה אליכם.
              </div>
            )}

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 font-bold text-blue-900">{readyForReview ? "כל דרישות החובה הושלמו. הפרופיל נשלח אוטומטית לאישור מנהל." : "לאחר השלמת דרישות החובה ואישור ההורה, הפרופיל יישלח אוטומטית לאישור מנהל."}</div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-bold text-slate-500">אופציונלי — לא נדרש להשלמת ההרשמה</p>
              <h3 className="mt-1 text-lg font-extrabold">התראות למכשיר</h3>
              <p className="mt-1 text-sm text-slate-600">אפשר להפעיל התראות עכשיו או בכל שלב מאוחר יותר.</p>
              <div className="mt-4"><WebPushControls compact /></div>
            </div>
            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setActiveStep(5)} className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">חזרה לשלב הקודם</button>
              <Link href="/dashboard/mentor" className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">מעבר לדשבורד</Link>
            </div>
          </form>
        )}
      </div>
    </MentorPageShell>
  );
}
