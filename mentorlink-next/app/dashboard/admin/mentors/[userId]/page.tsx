import AdminMentorsClient from "../_components/AdminMentorsClient";

export default async function AdminMentorDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminMentorsClient userId={userId} />;
}
