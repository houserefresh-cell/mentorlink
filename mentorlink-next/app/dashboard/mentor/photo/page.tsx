"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import {
  FormMessage,
  LoadingPage,
  MentorPageShell,
  MessageBox,
} from "../_components/MentorPageShell";

const BUCKET = "mentor-profile-photos";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function PhotoPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [storedPath, setStoredPath] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<FormMessage>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      setUserId(auth.user.id);
      const { data, error } = await supabase
        .from("mentor_profiles")
        .select("profile_photo_path")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        setMessage({ type: "error", text: `שגיאה בטעינת התמונה: ${error.message}` });
      } else if (data?.profile_photo_path) {
        setStoredPath(data.profile_photo_path);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(data.profile_photo_path, 3600);
        setPreviewUrl(signed?.signedUrl ?? "");
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "ניתן להעלות רק קובצי JPG, PNG או WEBP." });
      return;
    }
    if (file.size > MAX_SIZE) {
      setMessage({ type: "error", text: "גודל התמונה המרבי הוא 5MB." });
      return;
    }
    setWorking(true);
    setMessage(null);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/profile.${extension}`;
    if (storedPath && storedPath !== path) {
      const { error } = await supabase.storage.from(BUCKET).remove([storedPath]);
      if (error) console.error(error);
    }
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      console.error(uploadError);
      setMessage({ type: "error", text: `שגיאה בהעלאת התמונה: ${uploadError.message}` });
      setWorking(false);
      return;
    }
    const { error: profileError } = await supabase
      .from("mentor_profiles")
      .update({ profile_photo_path: path, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (profileError) {
      console.error(profileError);
      setMessage({ type: "error", text: `התמונה הועלתה אך לא קושרה לפרופיל: ${profileError.message}` });
    } else {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setStoredPath(path);
      setPreviewUrl(data?.signedUrl ?? "");
      setMessage({ type: "success", text: "תמונת הפרופיל נשמרה בהצלחה." });
    }
    setWorking(false);
  }

  async function removePhoto() {
    if (!storedPath) return;
    setWorking(true);
    setMessage(null);
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([storedPath]);
    if (storageError) {
      console.error(storageError);
      setMessage({ type: "error", text: `שגיאה במחיקת התמונה: ${storageError.message}` });
      setWorking(false);
      return;
    }
    const { error } = await supabase
      .from("mentor_profiles")
      .update({ profile_photo_path: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) console.error(error);
    setMessage(error
      ? { type: "error", text: `שגיאה בעדכון הפרופיל: ${error.message}` }
      : { type: "success", text: "התמונה הוסרה." });
    if (!error) { setStoredPath(""); setPreviewUrl(""); }
    setWorking(false);
  }

  if (loading) return <LoadingPage text="טוען תמונת פרופיל..." />;
  return (
    <MentorPageShell title="תמונת פרופיל" description="העלו תמונה ברורה ואמינה שתוצג למשפחות.">
      <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
        <div className="mx-auto mb-7 flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-4 border-blue-100 bg-slate-100">
          {previewUrl ? (
            <Image src={previewUrl} alt="תצוגה מקדימה של תמונת הפרופיל" width={224} height={224} unoptimized className="h-full w-full object-cover" />
          ) : (
            <span className="text-center font-bold text-slate-500">טרם הועלתה תמונה</span>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <label className="cursor-pointer rounded-xl bg-blue-600 px-6 py-3 text-center font-bold text-white hover:bg-blue-700">
            {working ? "מעבד..." : storedPath ? "החלפת תמונה" : "העלאת תמונה"}
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={upload} disabled={working} className="sr-only" />
          </label>
          {storedPath && <button type="button" onClick={removePhoto} disabled={working} className="rounded-xl border border-red-200 px-6 py-3 font-bold text-red-700 disabled:opacity-50">הסרת תמונה</button>}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">JPG, PNG או WEBP, עד 5MB.</p>
        <MessageBox message={message} />
      </div>
    </MentorPageShell>
  );
}
