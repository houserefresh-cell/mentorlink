import Link from "next/link";
import { Rubik } from "next/font/google";

import PublicHeader from "@/app/_components/PublicHeader";
import PublicMentorDirectory from "@/app/_components/PublicMentorDirectory";
import { getPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";

const homeBodyFont = Rubik({
  subsets: ["hebrew", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const worlds = [
  { icon: "⚽", title: "ספורט ותנועה", text: "כדורגל, כדורסל, כושר ועוד" },
  { icon: "📚", title: "לימודים ושפות", text: "מתמטיקה, אנגלית, מדעים ועוד" },
  { icon: "🎸", title: "יצירה ומוזיקה", text: "נגינה, ציור, צילום ויצירה" },
  { icon: "💡", title: "טכנולוגיה והעשרה", text: "תכנות, רובוטיקה וכישורי חיים" },
];

const steps = [
  { number: "01", title: "מגלים", text: "מחפשים חונכים ופעילויות לפי תחום, גיל, אזור והעדפות." },
  { number: "02", title: "מכירים", text: "קוראים את הפרופיל, שואלים שאלות ובוחנים אם החיבור מתאים." },
  { number: "03", title: "מתאמים", text: "ההורה והחונך מסכמים יחד את פרטי המפגש או הפעילות." },
];

export default async function HomePage() {
  let mentors: PublicMentor[] = [];

  try {
    mentors = await getPublishedMentors();
  } catch {
    console.error("Unable to load the public mentor directory.");
  }

  return (
    <main className={`${homeBodyFont.className} min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-950`} dir="rtl">
      <PublicHeader />

      <section className="relative isolate">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_12%_30%,rgba(139,92,246,0.16),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-b from-white/80 to-transparent" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.06fr_0.94fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 border-r-4 border-cyan-500 pr-3 text-sm font-extrabold text-blue-700">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              כישרון מקומי פוגש הזדמנות מקומית
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.08] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
              אנשים קרובים.
              <span className="block bg-gradient-to-l from-blue-700 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                חיבורים שמקדמים.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-slate-700 sm:text-xl">
              MentorLink מחברת בין ילדים ומשפחות לבין חונכים מהקהילה — ללמידה,
              לספורט, ליצירה, לטכנולוגיה ולכל תחום שאפשר לצמוח בו יחד.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register/parent" className="rounded-2xl bg-slate-950 px-6 py-4 font-extrabold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-blue-700">
                אני הורה — מתחילים כאן
              </Link>
              <Link href="/register/mentor" className="rounded-2xl border border-blue-200 bg-white px-6 py-4 font-extrabold text-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400">
                יש לי מה לתת — הרשמה כחונך
              </Link>
              <Link href="#mentors" className="rounded-2xl px-5 py-4 font-extrabold text-slate-700 transition hover:bg-white">
                להכיר את הקהילה ↓
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-extrabold text-slate-700">
              <span>● תחומים מגוונים</span>
              <span>● פעילויות ומפגשים</span>
              <span>● קהילה שמתחילה קרוב לבית</span>
            </div>
          </div>

          <HeroCommunityCard />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        <div className="rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-xl shadow-slate-200/60 backdrop-blur md:p-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {worlds.map((world, index) => (
              <article key={world.title} className={`rounded-3xl p-5 ${["bg-blue-50", "bg-amber-50", "bg-violet-50", "bg-cyan-50"][index]}`}>
                <span className="text-3xl" aria-hidden>{world.icon}</span>
                <h2 className="mt-4 text-lg font-black">{world.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{world.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-extrabold text-cyan-300">פשוט להתחיל</p>
              <h2 className="mt-3 text-4xl font-black leading-tight tracking-[-0.02em]">מהיכרות ראשונה<br />לחיבור אמיתי</h2>
              <p className="mt-5 max-w-md leading-7 text-slate-300">
                כל חיבור מתחיל בצורך, כישרון או סקרנות — ומתקדם בקצב שמתאים לאנשים שבתוכו.
              </p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <span className="text-sm font-black text-cyan-300">{step.number}</span>
                  <h3 className="mt-8 text-2xl font-black">{step.title}</h3>
                  <p className="mt-3 leading-7 text-slate-300">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-20 md:grid-cols-2 lg:px-8">
        <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 to-cyan-500 p-8 text-white shadow-xl">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <p className="font-bold text-blue-100">למשפחות</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.02em]">למצוא את האדם שמתאים לילד שלכם</h2>
          <p className="mt-4 max-w-xl leading-7 text-blue-50">חונכות אישית, פעילות קבוצתית או מפגש סביב תחום שמדליק סקרנות — עם אפשרות להכיר, לשאול ולבחור.</p>
          <Link href="/register/parent" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 font-extrabold text-blue-800">פתיחת חשבון הורה</Link>
        </article>
        <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 to-fuchsia-500 p-8 text-white shadow-xl">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <p className="font-bold text-violet-100">לחונכים</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.02em]">להפוך את מה שאתם יודעים להשפעה</h2>
          <p className="mt-4 max-w-xl leading-7 text-violet-50">בנו פרופיל, הציעו מפגשים או פתחו פעילות משלכם — והתחילו ליצור קשרים בתוך הקהילה.</p>
          <Link href="/register/mentor" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 font-extrabold text-violet-800">הרשמה כחונך</Link>
        </article>
      </section>

      <section id="mentors" className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="font-extrabold text-blue-700">הקהילה מתחילה כאן</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.02em]">הכירו חונכים מהאזור</h2>
              <p className="mt-3 leading-7 text-slate-600">מוצגים כאן רק חונכים שאושרו ופורסמו בפלטפורמה. מומלץ לקרוא, לשאול ולבחון באופן עצמאי את ההתאמה לצורך שלכם.</p>
            </div>
            <Link href="/register/parent" className="rounded-xl border border-slate-300 px-5 py-3 font-extrabold">כל אפשרויות החיפוש</Link>
          </div>
          <PublicMentorDirectory mentors={mentors} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-7 md:grid-cols-[0.7fr_1.3fr] md:p-10">
          <div>
            <p className="font-extrabold text-blue-700">חיבור עם שיקול דעת</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.02em]">הפלטפורמה מחברת.<br />האנשים בוחרים.</h2>
          </div>
          <div className="space-y-3 leading-7 text-slate-600">
            <p>MentorLink מספקת מקום להיכרות, הצגת מידע ותיאום. היא אינה מחליפה היכרות אישית, בירור התאמה או תיאום ציפיות בין הצדדים.</p>
            <p>ההחלטה על מפגש, מיקומו ותנאיו מתקבלת בין החונך לבין ההורה או האפוטרופוס. כשמעורבים קטינים, ההורה נשאר חלק מתהליך התיאום והקשר.</p>
            <p className="text-sm text-slate-500">פרטי קשר ומידע שאינם מיועדים לפרסום נשמרים מחוץ לפרופיל הציבורי, בהתאם להרשאות ולבחירות שניתנו במערכת.</p>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-gradient-to-l from-blue-700 via-violet-600 to-cyan-500 px-7 py-12 text-center text-white shadow-2xl md:px-12">
          <p className="font-bold text-white/80">החיבור הבא יכול להתחיל ממש קרוב</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-[-0.02em]">מה אתם רוצים ללמוד, ללמד או ליצור יחד?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register/parent" className="rounded-xl bg-white px-6 py-3 font-extrabold text-blue-800">אני מחפש/ת חונך או פעילות</Link>
            <Link href="/register/mentor" className="rounded-xl border border-white/50 bg-white/10 px-6 py-3 font-extrabold backdrop-blur">אני רוצה להיות חונך/ת</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-9 text-sm text-slate-600 lg:px-8">
          <div><strong className="text-lg text-slate-950">MentorLink</strong><span className="mr-3">צומחים יחד, קרוב לבית.</span></div>
          <div className="flex flex-wrap gap-5"><Link href="/">דף הבית</Link><Link href="/login">כניסה</Link><Link href="/register/parent">הרשמת הורה</Link><Link href="/register/mentor">הרשמת חונך</Link></div>
        </div>
      </footer>
    </main>
  );
}

function HeroCommunityCard() {
  return (
    <div className="relative mx-auto w-full max-w-xl py-8" aria-label="קהילה של חונכים, ילדים ומשפחות">
      <div className="absolute inset-8 rounded-[3rem] bg-gradient-to-br from-blue-600 via-violet-600 to-cyan-500 blur-2xl opacity-25" />
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-7 text-white shadow-2xl sm:p-9">
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-500/30 blur-2xl" />
        <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-cyan-400/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <span className="border-r-2 border-cyan-300 pr-3 text-xs font-extrabold text-slate-200">קרוב לבית • פתוח לרעיונות</span>
          <span className="text-2xl">✦</span>
        </div>
        <div className="relative mt-12 grid grid-cols-3 items-end gap-3 text-center">
          <CommunityPerson color="from-cyan-400 to-blue-500" icon="⚽" label="ספורט" />
          <CommunityPerson color="from-violet-400 to-fuchsia-500" icon="A+" label="לימודים" featured />
          <CommunityPerson color="from-amber-300 to-orange-500" icon="♪" label="יצירה" />
        </div>
        <div className="relative mt-10 rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
          <p className="text-sm text-slate-300">הרעיון פשוט</p>
          <p className="mt-1 text-xl font-black">ידע, ניסיון וסקרנות עוברים מאדם לאדם.</p>
        </div>
      </div>
    </div>
  );
}

function CommunityPerson({ color, icon, label, featured = false }: { color: string; icon: string; label: string; featured?: boolean }) {
  return (
    <div className={featured ? "-translate-y-5" : ""}>
      <div className={`mx-auto flex ${featured ? "h-24 w-24" : "h-20 w-20"} items-center justify-center rounded-full bg-gradient-to-br ${color} text-2xl font-black shadow-lg ring-4 ring-white/10`}>{icon}</div>
      <p className="mt-3 text-sm font-bold text-slate-200">{label}</p>
    </div>
  );
}
