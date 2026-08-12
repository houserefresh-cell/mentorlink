import Link from "next/link";
import Image from "next/image";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="MentorLink — דף הבית" className="flex shrink-0 items-center"><Image src="/mentorlink-logo.png" alt="" width={116} height={58} priority className="h-16 w-auto object-contain" /></Link>
          <nav className="flex flex-wrap items-center gap-2"><Link href="/dashboard/admin/mentors" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">חונכים</Link><Link href="/dashboard/admin/parents" className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50">הורים</Link><Link href="/dashboard/admin/feedback" className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50">משובים</Link><Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">לאתר הציבורי</Link></nav>
        </div>
      </header>
      {children}
    </>
  );
}
