import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "אישור הורה | MentorLink",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function ParentConsentVerifyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
