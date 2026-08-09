export type DiscoverySubject = {
  label: string;
  searchTerms?: readonly string[];
};

export type DiscoveryCategory = {
  icon: string;
  title: string;
  tone: string;
  featured?: boolean;
  subjects: readonly DiscoverySubject[];
};

const subject = (label: string, searchTerms?: readonly string[]): DiscoverySubject => ({ label, searchTerms });

export const MENTOR_DISCOVERY_CATEGORIES: readonly DiscoveryCategory[] = [
  { icon: "⚽", title: "ספורט קבוצתי", tone: "from-blue-50 to-cyan-50 border-blue-200", featured: true, subjects: [subject("כדורגל"), subject("כדורסל"), subject("כדורעף"), subject("כדוריד"), subject("בייסבול"), subject("פוטבול")] },
  { icon: "🎾", title: "ספורט יחידני", tone: "from-emerald-50 to-teal-50 border-emerald-200", featured: true, subjects: [subject("טניס"), subject("שחייה"), subject("ריצה"), subject("כושר"), subject("התעמלות"), subject("אומנויות לחימה"), subject("רכיבה"), subject("טניס שולחן (פינג פונג)", ["טניס שולחן", "פינג פונג"]), subject("סנוקר")] },
  { icon: "📘", title: "לימודים", tone: "from-indigo-50 to-blue-50 border-indigo-200", featured: true, subjects: [subject("מתמטיקה"), subject("מדעים"), subject("היסטוריה"), subject("גאוגרפיה"), subject("תנ״ך"), subject("הכנה לכיתה א׳"), subject("הכנת שיעורי בית"), subject("מיומנויות למידה"), subject("הכנה למבחנים")] },
  { icon: "💬", title: "שפות", tone: "from-rose-50 to-pink-50 border-rose-200", featured: true, subjects: [subject("עברית"), subject("אנגלית"), subject("אנגלית מדוברת"), subject("ערבית"), subject("ספרדית"), subject("צרפתית"), subject("רוסית"), subject("שפת הסימנים")] },
  { icon: "🤖", title: "טכנולוגיה", tone: "from-cyan-50 to-sky-50 border-cyan-200", featured: true, subjects: [subject("תכנות"), subject("רובוטיקה"), subject("בינה מלאכותית"), subject("בניית אתרים"), subject("מחשבים"), subject("הדפסה בתלת־ממד")] },
  { icon: "🎬", title: "יצירה דיגיטלית", tone: "from-violet-50 to-fuchsia-50 border-violet-200", featured: true, subjects: [subject("צילום"), subject("עריכת תמונות"), subject("עריכת וידאו"), subject("אנימציה"), subject("עיצוב גרפי"), subject("יצירת תוכן")] },
  { icon: "🎵", title: "מוזיקה", tone: "from-amber-50 to-orange-50 border-amber-200", featured: true, subjects: [subject("גיטרה"), subject("פסנתר"), subject("תופים"), subject("שירה"), subject("פיתוח קול"), subject("כלי נשיפה")] },
  { icon: "🎨", title: "אומנות ויצירה", tone: "from-orange-50 to-rose-50 border-orange-200", featured: true, subjects: [subject("ציור"), subject("פיסול"), subject("קומיקס"), subject("תפירה"), subject("יצירה בחומרים"), subject("תיאטרון"), subject("ריקוד")] },
  { icon: "🌟", title: "העצמה וביטחון עצמי", tone: "from-yellow-50 to-amber-50 border-yellow-200", subjects: [subject("ביטחון עצמי"), subject("מנהיגות"), subject("כישורים חברתיים")] },
  { icon: "🎤", title: "ביטוי עצמי ועמידה מול קהל", tone: "from-purple-50 to-violet-50 border-purple-200", subjects: [subject("עמידה מול קהל"), subject("הצגה"), subject("תקשורת")] },
  { icon: "♟️", title: "משחקים וחשיבה", tone: "from-slate-50 to-blue-50 border-slate-300", subjects: [subject("שחמט"), subject("משחקי קופסה"), subject("קובייה הונגרית"), subject("חידות"), subject("אסטרטגיה")] },
  { icon: "🚀", title: "מדע וסקרנות", tone: "from-sky-50 to-indigo-50 border-sky-200", subjects: [subject("חלל"), subject("טבע"), subject("בעלי חיים"), subject("ניסויים"), subject("קיימות"), subject("גינון"), subject("אלקטרוניקה")] },
  { icon: "🧁", title: "מיומנויות לחיים", tone: "from-lime-50 to-emerald-50 border-lime-200", subjects: [subject("בישול"), subject("אפייה"), subject("סדר וארגון"), subject("ניהול זמן"), subject("עצמאות")] },
] as const;

export function categorySearchTerms(category: DiscoveryCategory) {
  return category.subjects.flatMap((item) => item.searchTerms ?? [item.label]);
}

export function createSubjectSearchHref(targetPath: string, subjects: readonly string[], anchor = "mentor-search") {
  const params = new URLSearchParams({ search: "1" });
  for (const item of subjects) params.append("subject", item);
  return `${targetPath}?${params.toString()}#${anchor}`;
}
