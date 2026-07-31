import ParentRegistrations from "./ParentRegistrations";
import ParentActivityUpdates from "./ParentActivityUpdates";
export default function ParentActivitiesPage() { return <section className="mx-auto max-w-6xl"><p className="font-black text-violet-700">האזור המשפחתי</p><h1 className="mt-2 text-4xl font-black">הפעילויות שלי</h1><p className="mt-3 text-slate-600">כל ההרשמות, בחלוקה לפי ילד, כולל רשימת המתנה ועדכונים.</p><ParentActivityUpdates/><ParentRegistrations /></section>; }
