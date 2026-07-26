import Link from "next/link";

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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl font-black text-white shadow-lg shadow-blue-200">M</span>
          <span><span className="block text-xl font-black tracking-tight text-slate-950">MentorLink</span><span className="block text-xs font-bold text-slate-500">צומחים יחד</span></span>
        </Link>
        <nav aria-label="ניווט ציבורי" className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-blue-600">{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">התחברות</Link>
          <Link href="/register/mentor" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-600">הרשמה כחונך</Link>
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
