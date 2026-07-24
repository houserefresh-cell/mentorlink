import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-5xl w-full text-center">

        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          הצטרפו לקהילת MentorLink
        </h1>

        <p className="text-xl text-gray-600 mb-14">
          בחרו כיצד תרצו להצטרף לקהילה שלנו
        </p>

        <div className="grid md:grid-cols-2 gap-8">

          <Link
            href="/register/mentor"
            className="bg-white rounded-3xl shadow-lg p-10 hover:shadow-2xl hover:-translate-y-2 transition duration-300"
          >
            <div className="text-6xl mb-6">🧑‍🏫</div>

            <h2 className="text-3xl font-bold mb-4">
              אני רוצה להיות חונך
            </h2>

            <p className="text-gray-600 text-lg">
              ללמד, להשפיע ולהרוויח מהידע שלי.
            </p>
          </Link>

          <Link
            href="/register/parent"
            className="bg-white rounded-3xl shadow-lg p-10 hover:shadow-2xl hover:-translate-y-2 transition duration-300"
          >
            <div className="text-6xl mb-6">👨‍👩‍👧</div>

            <h2 className="text-3xl font-bold mb-4">
              אני רוצה להיות הורה
            </h2>

            <p className="text-gray-600 text-lg">
              למצוא את החונך המתאים ביותר לילד שלי.
            </p>
          </Link>

        </div>

        <div className="mt-12 text-gray-500">
          כבר יש לך חשבון?{" "}
          <Link
            href="/login"
            className="text-blue-600 font-semibold hover:underline"
          >
            התחבר
          </Link>
        </div>

      </div>
    </main>
  );
}