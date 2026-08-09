import Link from "next/link";

import { categorySearchTerms, createSubjectSearchHref, MENTOR_DISCOVERY_CATEGORIES } from "@/lib/subject-discovery";

function CategoryCard({ category, targetPath, anchor }: { category: (typeof MENTOR_DISCOVERY_CATEGORIES)[number]; targetPath: string; anchor: string }) {
  return (
    <article className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${category.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={createSubjectSearchHref(targetPath, categorySearchTerms(category), anchor)} className="group flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm" aria-hidden>{category.icon}</span>
          <div>
            <h3 className="text-lg font-black text-slate-950 group-hover:text-blue-700">{category.title}</h3>
            <span className="text-xs font-bold text-blue-700">לכל החונכים בתחום ←</span>
          </div>
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {category.subjects.map((item) => (
          <Link key={item.label} href={createSubjectSearchHref(targetPath, item.searchTerms ?? [item.label], anchor)} className="rounded-full border border-white bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700">
            {item.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

export default function SubjectDiscovery({ targetPath = "/" }: { targetPath?: string }) {
  const featured = MENTOR_DISCOVERY_CATEGORIES.filter((category) => category.featured);
  const more = MENTOR_DISCOVERY_CATEGORIES.filter((category) => !category.featured);
  const anchor = targetPath === "/" ? "mentors" : "mentor-search";

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8" aria-labelledby="subject-discovery-title">
      <div className="mb-8 text-center">
        <p className="font-extrabold text-blue-700">מה מעניין אתכם?</p>
        <h2 id="subject-discovery-title" className="mt-2 text-3xl font-black tracking-[-0.02em] text-slate-950 sm:text-4xl">מוצאים חונך לפי תחום</h2>
        <p className="mx-auto mt-3 max-w-2xl font-medium leading-7 text-slate-700">בחרו תחום כללי כדי לראות את כל החונכים המתאימים, או נושא מדויק לחיפוש ממוקד יותר.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {featured.map((category) => <CategoryCard key={category.title} category={category} targetPath={targetPath} anchor={anchor} />)}
      </div>
      <details className="group mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-center font-black text-blue-800 marker:hidden">עוד תחומים ורעיונות <span className="inline-block transition group-open:rotate-180">⌄</span></summary>
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 xl:grid-cols-3">
          {more.map((category) => <CategoryCard key={category.title} category={category} targetPath={targetPath} anchor={anchor} />)}
        </div>
      </details>
    </section>
  );
}
