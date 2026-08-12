import Link from "next/link";
import { Rubik } from "next/font/google";

import PublicHeader from "@/app/_components/PublicHeader";
import PublicMentorDirectory from "@/app/_components/PublicMentorDirectory";
import SubjectDiscovery from "@/app/_components/SubjectDiscovery";
import { getPublishedMentors } from "@/lib/public-mentor-data";
import type { PublicMentor } from "@/lib/public-mentor-core";

const homeBodyFont = Rubik({
  subsets: ["hebrew", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const journey = [
  { number: "1", icon: "profile", title: "חונכים מצטרפים", text: "בונים פרופיל, משתפים במה הם טובים ומציעים חונכות או פעילות." },
  { number: "2", icon: "search", title: "משפחות מחפשות", text: "נרשמים בחינם ומחפשים לפי תחום, גיל, אזור ואופן המפגש." },
  { number: "3", icon: "chat", title: "מכירים ומתאמים", text: "קוראים, שואלים שאלות ומתאמים יחד את פרטי המפגש." },
  { number: "4", icon: "grow", title: "מתחילים וצומחים", text: "יוצרים חיבור אנושי, לומדים מהדרך ומשתפים משוב מקצועי." },
] as const;

export default async function HomePage() {
  let mentors: PublicMentor[] = [];
  try {
    mentors = await getPublishedMentors();
  } catch {
    console.error("Unable to load the public mentor directory.");
  }

  return (
    <main className={`${homeBodyFont.className} min-h-screen overflow-hidden bg-[#fffaf3] text-[#17152b]`} dir="rtl">
      <PublicHeader />

      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_86%_20%,rgba(251,146,60,0.22),transparent_30%),radial-gradient(circle_at_10%_20%,rgba(45,212,191,0.20),transparent_30%),linear-gradient(180deg,#fffdf8_0%,#fff8ed_100%)]" />
        <div className="absolute -right-16 top-16 -z-10 h-52 w-52 rounded-full border-[34px] border-amber-200/40" />
        <div className="absolute -left-24 bottom-8 -z-10 h-72 w-72 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-sm font-extrabold text-[#5a2c10] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              כישרון מקומי פוגש הזדמנות מקומית
            </div>
            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.12] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
              חיבורים טובים מתחילים כאן.
              <span className="block bg-gradient-to-l from-[#ef6b32] via-[#a629d8] to-[#087f8c] bg-clip-text text-transparent">
                מכירים, לומדים וצומחים יחד.
              </span>
            </h1>
            <p className="mt-7 max-w-3xl text-lg font-bold leading-8 text-[#49435c] sm:text-xl">
              משפחות מוצאות חונכות אישית ופעילויות בתחומי לימודים, ספורט, יצירה, טכנולוגיה — וזאת רק ההתחלה.
              וחונכים משתפים את הידע והכישרון שלהם, יוצרים קשרים וצוברים ניסיון בתוך הקהילה.
            </p>
            <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-2">
              <article className="rounded-3xl border border-orange-200 bg-white/90 p-4 shadow-[0_16px_40px_-28px_rgba(124,45,18,0.5)]">
                <p className="text-sm font-bold leading-6 text-[#62586e]">נרשמים בחינם ומתחילים לחפש חונכים ופעילויות שמתאימים לילדים שלכם.</p>
                <Link href="/register/parent" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-l from-[#0f9f9a] to-[#3468dd] px-5 py-3 text-center font-black text-white shadow-lg shadow-cyan-100 transition hover:-translate-y-0.5">
                  הרשמה וחיפוש חונך או פעילות
                </Link>
              </article>
              <article className="rounded-3xl border border-teal-200 bg-white/90 p-4 shadow-[0_16px_40px_-28px_rgba(15,118,110,0.5)]">
                <p className="text-sm font-bold leading-6 text-[#62586e]">פותחים פרופיל חונך ומתחילים לשתף את הידע והכישרון שלכם.</p>
                <Link href="/register/mentor" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-l from-[#ff7a32] to-[#ef3b7d] px-5 py-3 text-center font-black text-white transition hover:-translate-y-0.5">
                  הרשמה ופתיחת פרופיל חונך
                </Link>
              </article>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="#how-it-works" className="rounded-xl px-4 py-3 font-black text-[#51338d] hover:bg-white">איך זה עובד? ↓</Link>
              <a href="tel:0522245128" className="rounded-xl border border-[#17152b]/15 bg-white px-4 py-3 font-black text-[#17152b] shadow-sm">צריכים עזרה בהרשמה? 052-224-5128</a>
            </div>
          </div>
          <HeroCommunityCard />
        </div>
      </section>

      <SubjectDiscovery />

      <section className="bg-gradient-to-l from-[#fff1df] via-[#fffaf3] to-[#e9fbf7] py-14">
        <div className="mx-auto max-w-5xl px-5 text-center lg:px-8">
          <p className="text-sm font-black text-[#9b3b12]">הטוב שבקהילה לפעמים קרוב יותר ממה שנדמה</p>
          <h2 className="mt-2 text-3xl font-black text-[#173f63] sm:text-4xl">לפעמים החיבור נמצא ממש מעבר לדלת</h2>
          <p className="mx-auto mt-5 max-w-4xl text-lg font-semibold leading-9 text-[#514a60]">הבן של השכנים מחפש מישהו להתאמן איתו בכדורגל. אחותו חולמת ללמוד פסנתר, אבל קשה למצוא מורה מתאים. ובמרחק כמה בתים גר חונך צעיר שאוהב כדורגל ומנגן בפסנתר כבר שמונה שנים. הם חיים באותה קהילה — ועדיין לא הכירו. MentorLink נועדה לעזור לחיבורים הטובים האלה לקרות: בין ילדים לחונכים, בין משפחות, ובין אנשים שיש להם הרבה מה לתת זה לזה.</p>
        </div>
      </section>

      <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden bg-[#fff1df] py-20">
        <div className="absolute -right-20 top-20 h-64 w-64 rounded-full bg-orange-200/50 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-teal-200/50 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-black text-[#9b3b12]">פשוט להכיר, לשאול ולהתחיל</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.025em] sm:text-5xl">איך MentorLink עובדת?</h2>
            <p className="mt-4 text-lg font-semibold leading-8 text-[#5a5269]">חיבור קהילתי בין ילדים ובני נוער לבין חונכים צעירים — עם מקום לסקרנות, אחריות, יוזמה וצמיחה משותפת.</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <ValueCard tone="bg-gradient-to-l from-[#e6fbf6] to-[#fff8e7] text-[#173f63]" title="מה ילדים מקבלים?" items={["ליווי אישי ותמיכה", "דמות קרובה ואכפתית", "חיזוק, התנסות והנאה"]} />
            <ValueCard tone="bg-gradient-to-l from-[#f4eaff] to-[#fff2e5] text-[#4f276f]" title="מה חונכים מקבלים?" items={["ניסיון משמעותי ותרומה לקהילה", "אחריות והתפתחות אישית", "יוזמה, הובלה וקשרים"]} />
          </div>

          <ol className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {journey.map((step) => (
              <li key={step.number} className="relative rounded-[2rem] border border-[#35264e]/10 bg-white p-6 shadow-[0_18px_50px_-36px_rgba(45,20,75,0.65)]">
                <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#17152b] text-sm font-black text-white">{step.number}</span>
                <StepIllustration kind={step.icon} />
                <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                <p className="mt-2 font-semibold leading-7 text-[#62586e]">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-center text-3xl font-black tracking-tight text-[#173f63]">להתחבר <span className="text-[#ef6b32]">|</span> להעצים <span className="text-[#ef6b32]">|</span> לצמוח יחד.</p>
        </div>
      </section>

      <section id="mentors" className="scroll-mt-24 bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="font-extrabold text-[#087f8c]">הקהילה מתחילה כאן</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.02em]">הכירו חונכים מהאזור</h2>
              <p className="mt-3 font-semibold leading-7 text-[#62586e]">אפשר לקרוא, לשאול ולבחון את ההתאמה לפני שמתקדמים למפגש או לפעילות.</p>
            </div>
            <Link href="/register/parent" className="rounded-xl border border-[#17152b]/20 bg-[#fffaf3] px-5 py-3 font-extrabold">הרשמה לכל אפשרויות החיפוש</Link>
          </div>
          <PublicMentorDirectory mentors={mentors} />
        </div>
      </section>

      <section id="feedback-explained" className="scroll-mt-24 bg-[#e9fbf7] py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-[3rem] bg-gradient-to-br from-teal-400 via-cyan-400 to-violet-500 shadow-2xl shadow-teal-200">
            <div className="rounded-[2rem] bg-white p-6 text-center shadow-xl">
              <p className="text-4xl">★ ★ ★</p>
              <p className="mt-2 font-black text-[#173f63]">משוב שעוזר לבחור</p>
            </div>
          </div>
          <div>
            <p className="font-black text-[#087f8c]">לומדים מניסיון הקהילה</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.025em]">איך המשובים עוזרים למצוא התאמה טובה?</h2>
            <p className="mt-4 text-lg font-semibold leading-8 text-[#554d63]">לאחר פעילות, הורים יכולים לשתף משוב מקצועי על החוויה. דירוגים ברורים, חוזקות ומשובים שאושרו לפרסום מסייעים להבין אילו חונכים עשויים להתאים לפי התחום, הגיל, האזור ואופן המפגש.</p>
            <p className="mt-3 font-semibold leading-7 text-[#62586e]">הערות פרטיות בנושאי בטיחות אינן מוצגות לציבור ומגיעות לבדיקת מנהל בלבד.</p>
            <Link href="/register/parent" className="mt-6 inline-flex rounded-2xl bg-[#087f8c] px-6 py-3 font-black text-white shadow-lg shadow-teal-200">למציאת חונכים שעשויים להתאים לילדכם</Link>
          </div>
        </div>
      </section>

      <section id="safety" className="scroll-mt-24 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-orange-200 bg-gradient-to-l from-[#fff1df] via-white to-[#ecfbf7] p-7 shadow-[0_24px_70px_-48px_rgba(83,40,16,0.5)] md:p-11">
          <div className="grid gap-8 md:grid-cols-[0.55fr_1.45fr]">
            <div>
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#173f63] text-4xl text-white shadow-lg">♡</div>
              <p className="mt-5 font-extrabold text-[#a2481c]">היכרות, שיחה ושיקול דעת</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.025em]">בטיחות ואמון נבנים בהדרגה</h2>
            </div>
            <div className="space-y-4 text-lg font-semibold leading-8 text-[#554d63]">
              <p>MentorLink יוצרת חיבורים בין משפחות לבין חונכים מהקהילה, ומסייעת להציג חונכים ופעילויות שעשויים להתאים לילדכם לפי התחום, הגיל, האזור והמידע שנמסר במערכת.</p>
              <p>הפלטפורמה מספקת מידע וכלים להיכרות ולתיאום, אך הבחירה בחונך ובאופן קיום המפגש נשארת בידי ההורה. מומלץ להכיר את החונך, לשוחח עמו, לשאול את כל השאלות החשובות ולוודא מראש את מקום המפגש, אופיו ותנאיו.</p>
              <p>במפגשים הראשונים נכון שההורה יהיה נוכח או מעורב, ושהמפגש יתקיים במקום מוכר ומתאים. ככל שההיכרות מתפתחת ונבנה אמון, ההורה יכול להחליט בהדרגה מהי רמת המעורבות שבה הוא מרגיש בנוח.</p>
              <p className="rounded-2xl border border-orange-200 bg-[#fff5e8] px-5 py-4 text-center font-black text-[#5a351f] shadow-sm">♡ הפלטפורמה מחברת. ההיכרות בונה אמון. ההורה בוחר את הדרך המתאימה לילדו.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-gradient-to-l from-[#173f63] via-[#6f2dbd] to-[#ef6b32] px-7 py-12 text-center text-white shadow-2xl md:px-12">
          <p className="font-bold text-white/85">החיבור הבא יכול להתחיל ממש קרוב</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-[-0.02em]">מה תרצו ללמוד, ללמד או ליצור יחד?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register/parent" className="rounded-xl bg-white px-6 py-3 font-extrabold text-[#173f63]">הרשמה וחיפוש חונך או פעילות</Link>
            <Link href="/register/mentor" className="rounded-xl border border-white/50 bg-white/10 px-6 py-3 font-extrabold backdrop-blur">הרשמה ופתיחת פרופיל חונך</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-orange-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-9 text-sm text-[#62586e] lg:px-8">
          <div><strong className="text-lg text-[#17152b]">MentorLink</strong><span className="mr-3">צומחים יחד, קרוב לבית.</span></div>
          <div className="flex flex-wrap gap-5"><Link href="/">דף הבית</Link><Link href="/login">כניסה</Link><Link href="/register/parent">הרשמת הורה</Link><Link href="/register/mentor">הרשמת חונך</Link></div>
        </div>
      </footer>
    </main>
  );
}

function HeroCommunityCard() {
  return (
    <div className="relative mx-auto w-full max-w-xl py-8" aria-label="חיבור בין חונכים לילדים בקהילה">
      <div className="absolute inset-8 rounded-[3rem] bg-gradient-to-br from-orange-400 via-fuchsia-500 to-teal-400 blur-2xl opacity-25" />
      <div className="relative overflow-hidden rounded-[2.5rem] border border-orange-200 bg-gradient-to-br from-[#fff8e9] via-[#f5ecff] to-[#e5fbf7] p-7 text-[#251b36] shadow-2xl sm:p-9">
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-2xl" />
        <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-teal-400/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <span className="border-r-2 border-orange-400 pr-3 text-sm font-extrabold text-[#6c3c21]">כישרונות מהקהילה, הזדמנויות לצמוח</span>
          <span className="text-3xl text-amber-300">✦</span>
        </div>
        <div className="relative mt-12 flex items-end justify-center gap-5 text-center">
          <CommunityPerson color="from-cyan-400 to-teal-500" icon="⚽" label="ספורט" />
          <div className="-translate-y-5">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-3xl font-black shadow-lg ring-4 ring-white/10">A+</div>
            <p className="mt-3 text-sm font-bold text-[#4f276f]">לימודים</p>
          </div>
          <CommunityPerson color="from-amber-300 to-orange-500" icon="♪" label="יצירה" />
        </div>
        <div className="relative mt-8 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur">
          <p className="text-lg font-black text-[#8b3d18]">הרעיון פשוט</p>
          <p className="mt-2 text-xl font-black leading-8">לכל ילד וילדה יש תחומי עניין, כישרונות וסקרנות שמחכים למקום הנכון לצמוח בו.</p>
          <p className="mt-2 font-semibold leading-7 text-[#62586e]">ב־MentorLink מוצאים חונכים ופעילויות מהקהילה, מכירים, שואלים ובוחרים יחד את החיבור שמתאים לילד שלכם.</p>
        </div>
      </div>
    </div>
  );
}

function CommunityPerson({ color, icon, label }: { color: string; icon: string; label: string }) {
  return <div><div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${color} text-2xl font-black shadow-lg ring-4 ring-white/70`}>{icon}</div><p className="mt-3 text-sm font-bold text-[#4f276f]">{label}</p></div>;
}

function ValueCard({ tone, title, items }: { tone: string; title: string; items: string[] }) {
  return (
    <article className={`rounded-[2rem] ${tone} border border-white p-7 shadow-xl`}>
      <h3 className="text-2xl font-black">{title}</h3>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item, index) => <li key={item} className="rounded-2xl bg-white/70 p-4 font-bold leading-6"><span className="mb-3 block text-2xl">{["♡", "✦", "↗"][index]}</span>{item}</li>)}
      </ul>
    </article>
  );
}

function StepIllustration({ kind }: { kind: (typeof journey)[number]["icon"] }) {
  const paths = {
    profile: <><circle cx="32" cy="25" r="10" /><path d="M14 55c2-14 10-21 18-21s16 7 18 21" /><path d="M53 18h18M62 9v18" /></>,
    search: <><circle cx="35" cy="31" r="17" /><path d="m48 44 15 15" /><path d="M28 31h14M35 24v14" /></>,
    chat: <><path d="M12 17h56v34H34L21 62V51h-9Z" /><path d="M25 30h30M25 39h21" /></>,
    grow: <><path d="M40 66V37" /><path d="M40 46c-16 0-22-8-22-20 14 0 22 7 22 20ZM40 37c16 0 22-8 22-20-14 0-22 7-22 20Z" /><path d="M18 66h44" /></>,
  };
  return (
    <div className="flex h-28 items-center justify-center rounded-3xl bg-gradient-to-br from-[#fff1df] to-[#e8fbf7]">
      <svg aria-hidden="true" viewBox="0 0 80 80" fill="none" stroke="#51338d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-20 w-20">{paths[kind]}</svg>
    </div>
  );
}
