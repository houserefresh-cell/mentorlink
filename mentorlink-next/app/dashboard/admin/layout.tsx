import Link from "next/link";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-extrabold text-blue-700">MentorLink</Link>
          <nav className="flex items-center gap-2"><Link href="/dashboard/admin/mentors" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">חונכים</Link><Link href="/dashboard/admin/feedback" className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50">משובים</Link><Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">לאתר הציבורי</Link></nav>
        </div>
      </header>
      {children}
    </>
  );
}
