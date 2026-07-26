import PublicHeader from "../_components/PublicHeader";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><PublicHeader />{children}</>;
}
