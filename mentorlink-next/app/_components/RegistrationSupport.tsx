const SUPPORT_PHONE_DISPLAY = "052-224-5128";
const SUPPORT_PHONE = "0522245128";
const WHATSAPP_PHONE = "972522245128";
const WHATSAPP_MESSAGE = encodeURIComponent("שלום, אני צריך/ה עזרה בהרשמה כחונך ב-MentorLink");

export default function RegistrationSupport({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <aside className="mt-6 rounded-3xl border border-teal-200 bg-gradient-to-l from-teal-50 to-orange-50 p-5 text-center text-slate-950 shadow-sm" dir="rtl">
        <p className="font-black">נתקעתם בהרשמה? אנחנו כאן לעזור</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">אפשר לפנות ישירות למנהל המערכת.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <a href={`https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_MESSAGE}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-center font-black text-white">WhatsApp</a>
          <a href={`tel:${SUPPORT_PHONE}`} className="rounded-xl border-2 border-teal-600 bg-white px-4 py-2 text-center font-black text-teal-800">חיוג {SUPPORT_PHONE_DISPLAY}</a>
        </div>
      </aside>
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
