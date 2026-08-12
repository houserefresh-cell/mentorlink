import Link from "next/link";
import Image from "next/image";

const navigation = [
  { href: "/#mentors", label: "מציאת חונך" },
  { href: "/#how-it-works", label: "איך זה עובד" },
  { href: "/#safety", label: "בטיחות ואמון" },
];

export default function PublicHeader() {
  return (
    <header dir="rtl" className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" aria-label="MentorLink — דף הבית" className="flex shrink-0 items-center gap-3">
          <Image src="/mentorlink-logo.png" alt="" width={160} height={76} priority className="h-16 w-auto scale-125 object-contain sm:h-20" />
        </Link>
        <nav aria-label="ניווט ציבורי" className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-blue-600">{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">התחברות</Link>
          <Link href="/register/mentor" className="rounded-xl bg-gradient-to-l from-violet-700 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5">הרשמה כחונך</Link>
        </div>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-800 marker:content-none">תפריט</summary>
          <nav aria-label="ניווט ציבורי לנייד" className="absolute left-0 top-12 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="grid gap-1">
              {navigation.map((item) => <Link key={item.href} href={item.href} className="rounded-xl px-4 py-3 font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700">{item.label}</Link>)}
              <Link href="/register/mentor" className="rounded-xl px-4 py-3 font-bold text-blue-700 hover:bg-blue-50">הרשמה כחונך</Link>
              <Link href="/login" className="mt-1 rounded-xl bg-slate-950 px-4 py-3 text-center font-bold text-white">התחברות</Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
