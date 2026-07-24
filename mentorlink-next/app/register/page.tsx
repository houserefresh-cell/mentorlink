import Link from "next/link";

export default function RegisterPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-indigo-50 px-6 py-16"
    >
      <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center">
        <div className="mb-12 max-w-3xl text-center">
          <span className="mb-5 inline-flex rounded-full bg-blue-100 px-5 py-2 text-sm font-bold text-blue-700">
            קהילה של למידה, צמיחה והצלחה
          </span>

          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
            הצטרפו לקהילת
            <span className="text-blue-600"> MentorLink</span>
          </h1>

          <p className="text-lg leading-8 text-slate-600 md:text-xl">
            בחרו כיצד תרצו להצטרף לקהילה שלנו ולהתחיל ליצור חיבורים
            שמובילים להצלחה.
          </p>
        </div>

        <div className="grid w-full max-w-5xl gap-7 md:grid-cols-2">
          <Link
            href="/register/mentor"
            className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-8 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl md:p-10"
          >
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue-100 opacity-70 transition duration-300 group-hover:scale-125" />

            <div className="relative">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 text-5xl">
                🧑‍🏫
              </div>

              <h2 className="mb-4 text-3xl font-extrabold text-slate-900">
                אני רוצה להיות חונך
              </h2>

              <p className="mb-8 text-lg leading-8 text-slate-600">
                ללמד, להשפיע, לצבור ניסיון ולהרוויח מהידע ומהיכולות שלי.
              </p>

              <div className="flex items-center gap-2 font-bold text-blue-600">
                מתחילים כחונכים
                <span className="transition duration-300 group-hover:-translate-x-2">
                  ←
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/register/parent"
            className="group relative overflow-hidden rounded-3xl border border-violet-100 bg-white p-8 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl md:p-10"
          >
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-100 opacity-70 transition duration-300 group-hover:scale-125" />

            <div className="relative">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100 text-5xl">
                👨‍👩‍👧
              </div>

              <h2 className="mb-4 text-3xl font-extrabold text-slate-900">
                אני רוצה לחפש חונך מתאים
              </h2>

              <p className="mb-8 text-lg leading-8 text-slate-600">
                למצוא חונך איכותי ומתאים לילד שלי, בקלות, בביטחון ועם יחס אישי.
              </p>

              <div className="flex items-center gap-2 font-bold text-violet-600">
                מחפשים חונך
                <span className="transition duration-300 group-hover:-translate-x-2">
                  ←
                </span>
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-10 text-slate-600">
          כבר יש לכם חשבון?{" "}
          <Link
            href="/login"
            className="font-bold text-blue-600 hover:underline"
          >
            התחברו כאן
          </Link>
        </p>
      </div>
    </main>
  );
}