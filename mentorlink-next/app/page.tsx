import Link from "next/link";

import PublicHeader from "@/app/_components/PublicHeader";
import PublicMentorDirectory from "@/app/_components/PublicMentorDirectory";
import { getPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";

const benefits = [
  "חונכות אישית בתוך הקהילה",
  "בחירה לפי תחום, אזור ואופן המפגש",
  "שמירה על פרטיות עד להיכרות אישית",
];

export default async function HomePage() {
  let mentors: PublicMentor[] = [];

  try {
    mentors = await getPublishedMentors();
  } catch {
    console.error("Unable to load the public mentor directory.");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950" dir="rtl">
      <PublicHeader />

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-20">
        <div className="space-y-7">
          <p className="text-sm font-bold text-blue-700">MentorLink — מחברים בין אנשים לדרך קדימה</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            מוצאים חונך מתאים, מקבלים ליווי אישי ומתקדמים יחד.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            MentorLink עוזרת להורים ולצעירים למצוא חונכים בתחומי לימוד, מיומנויות
            והתפתחות אישית, בתהליך ברור ובטוח.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="#mentors" className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">
              מציאת חונך
            </Link>
            <Link href="/register/mentor" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold">
              הרשמה כחונך
            </Link>
            <Link href="/login" className="rounded-xl px-5 py-3 font-bold text-blue-700">
              כניסה
            </Link>
          </div>
          <ul className="grid gap-3 text-slate-700 sm:grid-cols-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="rounded-xl bg-white p-4 shadow-sm">{benefit}</li>
            ))}
          </ul>
        </div>

        <aside className="rounded-3xl bg-blue-950 p-7 text-white shadow-xl">
          <h2 className="text-2xl font-black">איך מתחילים?</h2>
          <ol className="mt-6 space-y-5 text-blue-50">
            <li>1. מחפשים חונך לפי הצורך והעדפות המפגש.</li>
            <li>2. בוחנים את המידע הציבורי הבטוח בפרופיל.</li>
            <li>3. ממשיכים לתהליך החיבור דרך MentorLink.</li>
          </ol>
          <Link href="/register/parent" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-blue-950">
            הרשמה כהורה
          </Link>
        </aside>
      </section>

      <section id="mentors" className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-bold text-blue-700">חיפוש חונכים</p>
            <h2 className="mt-2 text-3xl font-black">הכירו חונכים זמינים</h2>
            <p className="mt-3 leading-7 text-slate-600">
              מוצגים כאן רק חונכים שאושרו ופורסמו על ידי צוות MentorLink. המידע
              מוגבל לפרטים ציבוריים שנבחרו בקפידה ואינו כולל פרטי קשר או מידע רגיש.
            </p>
          </div>
          <PublicMentorDirectory mentors={mentors} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black">תהליך פשוט וברור</h2>
            <p className="mt-3 leading-7 text-slate-600">
              החונכים משלימים פרופיל, עוברים בדיקה מנהלית ורק לאחר פרסום יזום מופיעים באזור הציבורי.
            </p>
          </article>
          <article className="rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black">בטיחות ופרטיות</h2>
            <p className="mt-3 leading-7 text-slate-600">
              פרטי קשר, מזהים פנימיים, תאריכי לידה ומידע על הסכמת הורים אינם מוצגים לציבור.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-600 lg:px-8">
          <span>© MentorLink</span>
          <div className="flex gap-5">
            <Link href="/">דף הבית</Link>
            <Link href="/login">כניסה</Link>
            <Link href="/register/mentor">הרשמה כחונך</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
