import type { Metadata } from "next";
import PublicHeader from "../../_components/PublicHeader";

export const metadata: Metadata = {
  title: "אישור הורה | MentorLink",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ParentConsentVerifyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><PublicHeader />{children}</>;
}
