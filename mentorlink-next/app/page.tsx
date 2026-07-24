"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Mentor = {
  id: number;
  name: string;
  age: number;
  city: string;
  category: string;
  specialty: string;
  price: number;
  rating: number;
  reviews: number;
  experience: string;
  verified: boolean;
  available: boolean;
  initials: string;
};

const categories = [
  { name: "הכול", icon: "✨" },
  { name: "לימודים", icon: "📚" },
  { name: "כדורגל", icon: "⚽" },
  { name: "מוזיקה", icon: "🎵" },
  { name: "מחשבים", icon: "💻" },
  { name: "אנגלית", icon: "🌍" },
  { name: "אמנות", icon: "🎨" },
];

const mentors: Mentor[] = [
  {
    id: 1,
    name: "נועה כהן",
    age: 17,
    city: "הוד השרון",
    category: "לימודים",
    specialty: "מתמטיקה ועזרה בשיעורי בית",
    price: 55,
    rating: 4.9,
    reviews: 28,
    experience: "שנתיים ניסיון",
    verified: true,
    available: true,
    initials: "נכ",
  },
  {
    id: 2,
    name: "אורי לוי",
    age: 18,
    city: "כפר סבא",
    category: "כדורגל",
    specialty: "אימוני כדורגל אישיים לילדים",
    price: 70,
    rating: 5,
    reviews: 34,
    experience: "שחקן ליגה פעיל",
    verified: true,
    available: true,
    initials: "אל",
  },
  {
    id: 3,
    name: "מאיה אברהם",
    age: 17,
    city: "רעננה",
    category: "אנגלית",
    specialty: "אנגלית מדוברת והכנה למבחנים",
    price: 60,
    rating: 4.8,
    reviews: 19,
    experience: "דוברת אנגלית",
    verified: true,
    available: false,
    initials: "מא",
  },
  {
    id: 4,
    name: "יונתן ברק",
    age: 18,
    city: "הרצליה",
    category: "מחשבים",
    specialty: "תכנות, משחקים ובניית אתרים",
    price: 75,
    rating: 4.9,
    reviews: 22,
    experience: "בוגר מגמת מחשבים",
    verified: true,
    available: true,
    initials: "יב",
  },
  {
    id: 5,
    name: "שירה רז",
    age: 16,
    city: "הוד השרון",
    category: "מוזיקה",
    specialty: "פסנתר ופיתוח שמיעה מוזיקלית",
    price: 65,
    rating: 4.7,
    reviews: 15,
    experience: "8 שנות נגינה",
    verified: true,
    available: true,
    initials: "שר",
  },
  {
    id: 6,
    name: "תמר ישראלי",
    age: 17,
    city: "פתח תקווה",
    category: "אמנות",
    specialty: "ציור, יצירה ופיתוח הדמיון",
    price: 50,
    rating: 4.9,
    reviews: 17,
    experience: "מדריכה בתנועת נוער",
    verified: true,
    available: true,
    initials: "תי",
  },
];

const benefits = [
  {
    icon: "🛡️",
    title: "סביבה בטוחה",
    text: "חונכים מאומתים, דירוגים, המלצות ומערכת דיווח מסודרת.",
  },
  {
    icon: "🤝",
    title: "חיבור אישי",
    text: "מציאת חונך צעיר שהילד יכול להתחבר אליו וללמוד ממנו.",
  },
  {
    icon: "🌱",
    title: "צומחים יחד",
    text: "הילדים מתקדמים והחונכים מפתחים אחריות, ניסיון וביטחון.",
  },
];

export default function Home() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("הכול");
  const [selectedCity, setSelectedCity] = useState("כל הארץ");
  const [favorites, setFavorites] = useState<number[]>([]);

  const filteredMentors = useMemo(() => {
    return mentors.filter((mentor) => {
      const matchesSearch =
        mentor.name.includes(search) ||
        mentor.specialty.includes(search) ||
        mentor.city.includes(search);

      const matchesCategory =
        selectedCategory === "הכול" ||
        mentor.category === selectedCategory;

      const matchesCity =
        selectedCity === "כל הארץ" || mentor.city === selectedCity;

      return matchesSearch && matchesCategory && matchesCity;
    });
  }, [search, selectedCategory, selectedCity]);

  function toggleFavorite(id: number) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl font-black text-white shadow-lg shadow-blue-200">
              M
            </div>

            <div>
              <div className="text-xl font-black tracking-tight">
                MentorLink
              </div>
              <div className="text-xs font-medium text-slate-500">
                צומחים יחד
              </div>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <a href="#mentors" className="transition hover:text-blue-600">
              מציאת חונך
            </a>
            <a href="#how-it-works" className="transition hover:text-blue-600">
              איך זה עובד?
            </a>
            <a href="#safety" className="transition hover:text-blue-600">
              בטיחות
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:block">
              התחברות
            </button>

            <Link
  href="/register"
  className="rounded-xl bg-slate-950 ..."
>
  הרשמה חינם
</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-white">
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              <span>⭐</span>
              המקום שבו ילדים ובני נוער צומחים יחד
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              החונך הנכון יכול
              <span className="block bg-gradient-to-l from-blue-600 to-violet-600 bg-clip-text text-transparent">
                לשנות לילד את הדרך
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              MentorLink מחברת בין ילדים לבין בני נוער איכותיים בתחומי
              הלימודים, הספורט, המוזיקה, המחשבים והיצירה — בצורה אישית,
              נגישה ובטוחה.
            </p>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4">
                  <span className="text-xl">🔍</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="מה הילד רוצה ללמוד?"
                    className="h-14 w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                  />
                </div>

                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="h-14 rounded-2xl border-0 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none"
                >
                  <option>כל הארץ</option>
                  <option>הוד השרון</option>
                  <option>כפר סבא</option>
                  <option>רעננה</option>
                  <option>הרצליה</option>
                  <option>פתח תקווה</option>
                </select>

                <a
                  href="#mentors"
                  className="flex h-14 items-center justify-center rounded-2xl bg-blue-600 px-7 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  חיפוש חונכים
                </a>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-semibold text-slate-500">
              <span>✓ הרשמה ללא עלות</span>
              <span>✓ חונכים מאומתים</span>
              <span>✓ בחירה לפי המלצות</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[40px] bg-gradient-to-br from-blue-200 to-violet-200 opacity-60 blur-2xl" />

            <div className="relative rounded-[36px] border border-white bg-slate-950 p-6 shadow-2xl sm:p-8">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-blue-300">
                    חונך מומלץ באזור שלך
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    הכירו את אורי
                  </h2>
                </div>

                <div className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300">
                  זמין השבוע
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-500 text-2xl font-black text-white">
                    אל
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">אורי לוי</h3>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-black text-blue-700">
                        ✓ מאומת
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-medium text-slate-500">
                      בן 18 · כפר סבא
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="font-black text-amber-500">★ 5.0</span>
                      <span className="text-sm text-slate-400">
                        34 המלצות
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-400">
                    תחום החונכות
                  </p>
                  <p className="mt-1 font-black text-slate-800">
                    אימוני כדורגל אישיים לילדים
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black">₪70</span>
                    <span className="text-sm font-medium text-slate-500">
                      {" "}
                      למפגש
                    </span>
                  </div>

                  <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-600">
                    צפייה בפרופיל
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-white">
                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xl font-black">500+</div>
                  <div className="mt-1 text-xs text-slate-300">חונכים</div>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xl font-black">4.9</div>
                  <div className="mt-1 text-xs text-slate-300">דירוג ממוצע</div>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <div className="text-xl font-black">98%</div>
                  <div className="mt-1 text-xs text-slate-300">שביעות רצון</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-5 lg:px-8">
          {categories.map((category) => {
            const selected = selectedCategory === category.name;

            return (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(category.name)}
                className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black transition ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-300"
                }`}
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            );
          })}
        </div>
      </section>

      <section
        id="mentors"
        className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black text-blue-600">
              חונכים מובילים
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              מצאו את החיבור המתאים
            </h2>
            <p className="mt-3 text-slate-500">
              ניתן לסנן לפי תחום, אזור, המלצות ומחיר.
            </p>
          </div>

          <div className="text-sm font-bold text-slate-500">
            נמצאו {filteredMentors.length} חונכים
          </div>
        </div>

        {filteredMentors.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredMentors.map((mentor) => {
              const favorite = favorites.includes(mentor.id);

              return (
                <article
                  key={mentor.id}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-lg font-black text-white">
                        {mentor.initials}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">
                            {mentor.name}
                          </h3>

                          {mentor.verified && (
                            <span
                              title="פרופיל מאומת"
                              className="text-blue-600"
                            >
                              ●
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm font-medium text-slate-500">
                          בן {mentor.age} · {mentor.city}
                        </p>

                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="font-black text-amber-500">
                            ★ {mentor.rating}
                          </span>
                          <span className="text-slate-400">
                            ({mentor.reviews} המלצות)
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleFavorite(mentor.id)}
                      aria-label="הוספה למועדפים"
                      className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg transition ${
                        favorite
                          ? "border-rose-200 bg-rose-50 text-rose-500"
                          : "border-slate-200 bg-white text-slate-400 hover:text-rose-500"
                      }`}
                    >
                      {favorite ? "♥" : "♡"}
                    </button>
                  </div>

                  <div className="mt-5">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                      {mentor.category}
                    </span>

                    <h4 className="mt-4 min-h-12 text-base font-black leading-6 text-slate-800">
                      {mentor.specialty}
                    </h4>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-y border-slate-100 py-4 text-sm">
                    <span className="font-semibold text-slate-500">
                      {mentor.experience}
                    </span>

                    <span
                      className={`font-black ${
                        mentor.available
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {mentor.available ? "● זמין עכשיו" : "● זמינות מוגבלת"}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-black">
                        ₪{mentor.price}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {" "}
                        למפגש
                      </span>
                    </div>

                    <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition group-hover:bg-blue-600">
                      צפייה בפרופיל
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="text-4xl">🔍</div>
            <h3 className="mt-4 text-xl font-black">
              לא נמצאו חונכים מתאימים
            </h3>
            <p className="mt-2 text-slate-500">
              נסו לשנות את תחום החיפוש או לבחור אזור אחר.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("הכול");
                setSelectedCity("כל הארץ");
              }}
              className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              ניקוי הסינון
            </button>
          </div>
        )}
      </section>

      <section id="how-it-works" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black text-blue-300">פשוט ונוח</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              איך MentorLink עובדת?
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              בתוך כמה דקות תוכלו למצוא חונך מתאים ולהתחיל תהליך אישי.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "מחפשים",
                text: "בוחרים תחום, אזור והעדפות אישיות.",
              },
              {
                number: "02",
                title: "מכירים",
                text: "קוראים פרופילים, המלצות ודירוגים.",
              },
              {
                number: "03",
                title: "מתקדמים",
                text: "קובעים מפגש ומתחילים לצמוח יחד.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-white/10 bg-white/5 p-7"
              >
                <div className="text-sm font-black text-blue-300">
                  {step.number}
                </div>
                <h3 className="mt-8 text-2xl font-black">{step.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="safety" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              הרבה מעבר לשיעור
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              פלטפורמה שבנויה על אמון
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-7"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  {benefit.icon}
                </div>
                <h3 className="mt-6 text-xl font-black">{benefit.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {benefit.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-gradient-to-l from-blue-600 to-violet-600 px-6 py-12 text-center text-white shadow-2xl shadow-blue-200 sm:px-12 sm:py-16">
          <h2 className="text-3xl font-black sm:text-4xl">
            יש לכם מה לתת לדור הצעיר?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-blue-50">
            בני ובנות נוער יכולים להצטרף כחונכים, לצבור ניסיון, להרוויח
            כסף ולעזור לילדים להתקדם.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button className="rounded-2xl bg-white px-7 py-4 text-sm font-black text-blue-700 transition hover:-translate-y-0.5">
              אני רוצה להיות חונך
            </button>

            <button className="rounded-2xl border border-white/40 bg-white/10 px-7 py-4 text-sm font-black text-white transition hover:bg-white/20">
              מידע להורים
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 text-center sm:flex-row sm:text-right lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-black text-white">
              M
            </div>
            <div>
              <div className="font-black">MentorLink</div>
              <div className="text-xs text-slate-400">צומחים יחד</div>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            © 2026 MentorLink. כל הזכויות שמורות.
          </p>

          <div className="flex gap-5 text-sm font-bold text-slate-500">
            <a href="#" className="hover:text-blue-600">
              פרטיות
            </a>
            <a href="#" className="hover:text-blue-600">
              תנאי שימוש
            </a>
            <a href="#" className="hover:text-blue-600">
              יצירת קשר
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}