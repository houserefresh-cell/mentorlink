"use client";

import { useState } from "react";
import type { PublicMentor } from "@/lib/public-mentor-core";
import MentorProfileDialog from "./MentorProfileDialog";

export default function MentorNameButton({
  bookingId,
  displayName,
  className = "",
}: {
  bookingId: string | null | undefined;
  displayName: string;
  className?: string;
}) {
  const [mentor, setMentor] = useState<PublicMentor | null>(null);
  const [loading, setLoading] = useState(false);

  if (!bookingId) return <span className={className}>{displayName}</span>;

  async function open() {
    if (mentor) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/public-mentors/${encodeURIComponent(bookingId!)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.mentor) setMentor(body.mentor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void open()} className={`text-right font-black underline decoration-blue-300 underline-offset-4 transition hover:text-blue-700 ${className}`}>
        {loading ? `${displayName}…` : displayName}
      </button>
      {mentor ? <MentorProfileDialog mentor={mentor} onMeeting={() => { window.location.href = `/dashboard/parent?mentor=${encodeURIComponent(mentor.bookingId)}&action=meeting#mentor-search`; }} onClose={() => setMentor(null)} /> : null}
    </>
  );
}
