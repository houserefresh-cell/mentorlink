import Link from "next/link";
import PublicHeader from "./_components/PublicHeader";

const examples = [
  ["נכ", "נועה", "הוד השרון", "מתמטיקה ועזרה בשיעורי בית", "from-blue-500 to-cyan-500"],
  ["אל", "אורי", "כפר סבא", "ספורט וכדורגל", "from-violet-500 to-fuchsia-500"],
  ["מא", "מאיה", "רעננה", "אנגלית והכנה למבחנים", "from-amber-500 to-orange-500"],
] as const;

const benefits = [
  ["🛡️", "בטיחות לפני הכול", "תהליך הצטרפות ובדיקה מסודר שנועד לבנות קהילה אחראית ואמינה."],
  ["🤝", "חיבור אישי", "התאמה לפי תחומי עניין, אזור, גיל והעדפות אישיות."],
  ["🌱", "צומחים יחד", "ילדים מתקדמים וחונכים צעירים מפתחים אחריות, ניסיון וביטחון."],
] as const;

export default function HomePage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <PublicHeader />
      <section className="relative overflow-hidden bg-white">
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">קהילה לחונכות אישית, קרובה ובטוחה</p>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              החיבור הנכון יכול
              <span className="block bg-gradient-to-l from-blue-600 to-violet-600 bg-clip-text text-transparent">לשנות לילד את הדרך</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">MentorLink מחברת בין ילדים ומשפחות לבין חונכים צעירים בתחומי הלימודים, הספורט, המוזיקה, המחשבים והיצירה.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="#mentors" className="rounded-2xl bg-blue-600 px-7 py-4 text-center font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">לגלות את אזור החונכים</Link>
              <Link href="/register/mentor" className="rounded-2xl border border-slate-300 bg-white px-7 py-4 text-center font-black text-slate-800 transition hover:border-blue-300 hover:bg-blue-50">אני רוצה להיות חונך</Link>
              <Link href="/login" className="rounded-2xl px-7 py-4 text-center font-black text-slate-700 transition hover:bg-slate-100">התחברות</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[40px] bg-gradient-to-br from-blue-200 to-violet-200 opacity-70 blur-2xl" />
            <div className="relative rounded-[36px] bg-slate-950 p-7 text-white shadow-2xl">
              <p className="text-sm font-black text-blue-300">החיפוש הציבורי המלא ייפתח בהמשך</p>
              <h2 className="mt-2 text-3xl font-black">בינתיים אפשר להכיר את הדרך</h2>
              <div className="mt-7 grid gap-3">
                {["בוחרים תחום ואזור", "מכירים את החונך", "מתקדמים יחד"].map((step, index) => (
                  <div key={step} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 font-black">{index + 1}</span>
                    <span className="font-bold">{step}</span>
                  </div>
                ))}
              </div>
              <Link href="/register/parent" className="mt-7 block rounded-2xl bg-white px-6 py-4 text-center font-black text-blue-700 transition hover:bg-blue-50">הצטרפות כהורה</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="mentors" aria-labelledby="mentors-title" className="scroll-mt-24 bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-blue-600">אזור החונכים</p>
            <h2 id="mentors-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">כך ייראו החיבורים ב-MentorLink</h2>
            <p className="mt-4 leading-7 text-slate-600">הכרטיסים הבאים הם דוגמאות להמחשה בלבד. הם אינם פרופילים של חונכים אמיתיים, אינם מחוברים למסד הנתונים ואי אפשר ליצור דרכם קשר.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {examples.map(([initials, name, area, subject, color]) => (
              <article key={name} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-lg font-black text-white`}>{initials}</div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">דוגמה בלבד</span>
                </div>
                <h3 className="mt-5 text-xl font-black">{name}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500">אזור לדוגמה: {area}</p>
                <p className="mt-5 rounded-2xl bg-slate-50 p-4 font-bold text-slate-800">{subject}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/register/parent" className="inline-flex rounded-2xl bg-slate-950 px-7 py-4 font-black text-white transition hover:bg-blue-600">הצטרפו כדי לקבל עדכון כשהחיפוש ייפתח</Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-black text-blue-300">פשוט וברור</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">איך MentorLink עובדת?</h2></div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["01", "מגדירים צורך", "תחום, אזור והעדפות שמתאימים לילד."],
              ["02", "מכירים בבטחה", "עוברים על מידע שנבדק ומחליטים יחד."],
              ["03", "מתחילים לצמוח", "יוצרים חיבור אישי ומתקדמים בקצב הנכון."],
            ].map(([number, title, text]) => (
              <article key={number} className="rounded-3xl border border-white/10 bg-white/5 p-7">
                <p className="text-sm font-black text-blue-300">{number}</p><h3 className="mt-7 text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-300">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="safety" className="scroll-mt-24 bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center"><p className="text-sm font-black text-blue-600">הרבה מעבר לשיעור</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">פלטפורמה שבנויה על אמון</h2></div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map(([icon, title, text]) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
                <span className="text-3xl" aria-hidden="true">{icon}</span><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 text-center sm:flex-row sm:text-right lg:px-8">
          <Link href="/" className="font-black text-slate-950">MentorLink</Link>
          <p className="text-sm text-slate-500">© 2026 MentorLink. צומחים יחד.</p>
          <div className="flex gap-5 text-sm font-bold"><Link href="/register/mentor" className="hover:text-blue-600">הרשמה כחונך</Link><Link href="/login" className="hover:text-blue-600">התחברות</Link></div>
        </div>
      </footer>
    </main>
  );
}
