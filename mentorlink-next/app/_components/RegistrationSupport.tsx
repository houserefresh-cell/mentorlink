const SUPPORT_PHONE_DISPLAY = "052-224-5128";
const SUPPORT_PHONE = "0522245128";
const WHATSAPP_PHONE = "972522245128";
const WHATSAPP_MESSAGE = encodeURIComponent("שלום, אני צריך/ה עזרה בהרשמה כחונך ב-MentorLink");

export default function RegistrationSupport({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <details className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-blue-300 bg-white p-2 text-slate-950 shadow-2xl">
        <summary className="cursor-pointer list-none rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white marker:hidden">פנייה למנהל</summary>
        <div className="w-72 max-w-full p-3 text-right" dir="rtl">
          <p className="font-black">אפשר ליצור קשר עם מנהל המערכת</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">נשמח לעזור להשלים את ההרשמה.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_MESSAGE}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-3 py-2 text-center font-black text-white">WhatsApp</a>
            <a href={`tel:${SUPPORT_PHONE}`} className="rounded-xl border-2 border-blue-600 px-3 py-2 text-center font-black text-blue-800">חיוג</a>
          </div>
        </div>
      </details>
    );
  }

  return (
    <aside className="mt-6 rounded-3xl border-2 border-blue-200 bg-white p-5 text-center text-slate-950 shadow-sm" dir="rtl">
      <h2 className="text-xl font-black">עזרה בהרשמה — פנייה למנהל</h2>
      <p className="mt-2 font-semibold text-slate-700">אפשר ליצור קשר עם מנהל המערכת בטלפון {SUPPORT_PHONE_DISPLAY}.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <a href={`https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_MESSAGE}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">שליחת הודעה ב־WhatsApp</a>
        <a href={`tel:${SUPPORT_PHONE}`} className="rounded-xl border-2 border-blue-600 px-5 py-3 font-black text-blue-800">חיוג למנהל</a>
      </div>
    </aside>
  );
}
