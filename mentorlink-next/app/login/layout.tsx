import PublicHeader from "../_components/PublicHeader";

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><PublicHeader />{children}</>;
}
