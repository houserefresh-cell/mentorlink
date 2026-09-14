"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Community = {
  id: string;
  name: string;
  locality: string;
  description: string;
  isPublic: boolean;
  status: string;
  isPilot: boolean;
  pendingCount: number;
  createdAt: string;
};

type CommunityDetail = {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  status: string;
  isPilot: boolean;
  locality: string;
};

type CommunityMembership = {
  id: string;
  user_id: string;
  status: string;
  joined_via: string;
  created_at: string | null;
  user: { name: string; email: string | null; phone: string | null } | null;
};

type CommunityInvitation = {
  id: string;
  invite_type: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number | null;
  revoked_at: string | null;
  created_at: string | null;
};

export default function AdminCommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [communityDetail, setCommunityDetail] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMembership[]>([]);
  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CommunityMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [locality, setLocality] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isPilot, setIsPilot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null }>>([]);
  const [inviteDays, setInviteDays] = useState(30);
  const [inviteMaxUses, setInviteMaxUses] = useState(0);

  async function getSessionToken() {
    const session = (await supabase.auth.getSession()).data.session;
    return session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/communities", {
        headers: { Authorization: `Bearer ${await getSessionToken()}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "לא ניתן לטעון קהילות");
      setCommunities(Array.isArray(body.communities) ? body.communities : []);
      setError("");
      if (!selectedCommunityId && Array.isArray(body.communities) && body.communities[0]) {
        setSelectedCommunityId(body.communities[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "לא ניתן לטעון קהילות");
      if (reason instanceof Error && reason.message === "AUTHENTICATION_REQUIRED") {
        window.location.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(communityId: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/communities?communityId=${encodeURIComponent(communityId)}`, {
        headers: { Authorization: `Bearer ${await getSessionToken()}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "לא ניתן לטעון פרטי קהילה");
      setCommunityDetail(body.community ?? null);
      setMembers(Array.isArray(body.members) ? body.members : []);
      setPendingRequests(Array.isArray(body.pendingRequests) ? body.pendingRequests : []);
      setInvitations(Array.isArray(body.invitations) ? body.invitations : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "לא ניתן לטעון פרטי קהילה");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedCommunityId) {
      void loadDetail(selectedCommunityId);
    }
  }, [selectedCommunityId]);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId],
  );

  async function createCommunity() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/communities", {
        method: "POST",
        headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, locality, description, isPublic, isPilot, status: "active" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "לא ניתן ליצור קהילה");
      setName("");
      setLocality("");
      setDescription("");
      setIsPublic(true);
      setIsPilot(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "לא ניתן ליצור קהילה");
    } finally {
      setBusy(false);
    }
  }

  async function updateCommunity() {
    if (!communityDetail) return;
    try {
      const response = await fetch("/api/admin/communities", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-community",
          id: communityDetail.id,
          name: communityDetail.name,
          locality: communityDetail.locality,
          description: communityDetail.description,
          isPublic: communityDetail.isPublic,
          isPilot: communityDetail.isPilot,
          status: communityDetail.status,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "לא ניתן לעדכן קהילה");
      await load();
      if (selectedCommunityId) await loadDetail(selectedCommunityId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "לא ניתן לעדכן קהילה");
    }
  }

  async function approveMembership(membershipId: string) {
    const response = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve-membership", membershipId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן לאשר חבר בקהילה");
      return;
    }
    if (selectedCommunityId) await loadDetail(selectedCommunityId);
    await load();
  }

  async function rejectMembership(membershipId: string) {
    const response = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject-membership", membershipId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן לדחות חבר בקהילה");
      return;
    }
    if (selectedCommunityId) await loadDetail(selectedCommunityId);
    await load();
  }

  async function searchUsers() {
    const term = userSearch.trim();
    if (!term) {
      setUserResults([]);
      return;
    }
    const response = await fetch(`/api/admin/communities?q=${encodeURIComponent(term)}`, {
      headers: { Authorization: `Bearer ${await getSessionToken()}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן לחפש משתמשים");
      return;
    }
    setUserResults(Array.isArray(body.users) ? body.users : []);
  }

  async function manualAddMember(userId: string) {
    if (!selectedCommunityId) return;
    const response = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manual-add-member", communityId: selectedCommunityId, userId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן להוסיף חבר בקהילה");
      return;
    }
    setUserSearch("");
    setUserResults([]);
    if (selectedCommunityId) await loadDetail(selectedCommunityId);
    await load();
  }

  async function generateInvite() {
    if (!selectedCommunityId) return;
    const response = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate-invite", communityId: selectedCommunityId, days: inviteDays, maxUses: inviteMaxUses }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן ליצור הזמנה");
      return;
    }
    const invite = body.invite ?? null;
    if (invite?.url) {
      window.alert(`קישור הזמנה: ${invite.url}`);
    }
    if (selectedCommunityId) await loadDetail(selectedCommunityId);
  }

  async function revokeInvite(invitationId: string) {
    const response = await fetch("/api/admin/communities", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await getSessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke-invite", invitationId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "לא ניתן לבטל הזמנה");
      return;
    }
    if (selectedCommunityId) await loadDetail(selectedCommunityId);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black text-violet-700">ניהול קהילות</p>
          <h1 className="mt-2 text-3xl font-black">קהילות</h1>
          <p className="mt-2 text-slate-600">ניהול קהילות, בקשות חברות, הזמנות, והגבלות גישה לפי קהילה.</p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">יצירת קהילה</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              שם קהילה
              <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" placeholder="למשל בית ספר השחר" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              עיר/יישוב
              <input value={locality} onChange={(event) => setLocality(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" placeholder="למשל הוד השרון" />
            </label>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
            תיאור
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" placeholder="אופציונלי" />
          </label>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> ציבורית</label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={isPilot} onChange={(event) => setIsPilot(event.target.checked)} /> pilot</label>
          </div>
          <button disabled={busy || !name.trim() || !locality.trim()} onClick={createCommunity} className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-black text-white disabled:bg-slate-300">{busy ? "יוצר..." : "צור קהילה"}</button>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">רשימת קהילות</h2>
            {loading ? (
              <p className="mt-4 font-bold text-slate-500">טוען...</p>
            ) : communities.length === 0 ? (
              <p className="mt-4 text-slate-500">עדיין לא נוצרו קהילות.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {communities.map((community) => (
                  <button
                    type="button"
                    key={community.id}
                    onClick={() => setSelectedCommunityId(community.id)}
                    className={`rounded-2xl border p-4 text-right transition ${selectedCommunityId === community.id ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black">{community.name}</h3>
                        <p className="text-sm font-bold text-slate-500">{community.locality}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-bold">
                        <span className="rounded-full bg-slate-200 px-2 py-1">{community.status}</span>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{community.isPublic ? "ציבורית" : "פרטית"}</span>
                        {community.pendingCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{community.pendingCount} בהמתנה</span> : null}
                      </div>
                    </div>
                    {community.description ? <p className="mt-3 text-sm text-slate-600">{community.description}</p> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {detailLoading ? (
              <p className="font-bold text-slate-600">טוען פרטי קהילה...</p>
            ) : communityDetail ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-violet-700">פרטי קהילה</p>
                    <h2 className="mt-1 text-2xl font-black">{communityDetail.name}</h2>
                  </div>
                  <button type="button" onClick={updateCommunity} className="rounded-xl bg-violet-700 px-4 py-2 font-black text-white">שמור שינויים</button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    שם קהילה
                    <input value={communityDetail.name} onChange={(event) => setCommunityDetail({ ...communityDetail, name: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    עיר/יישוב
                    <input value={communityDetail.locality} onChange={(event) => setCommunityDetail({ ...communityDetail, locality: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2" />
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                    תיאור
                    <textarea value={communityDetail.description} rows={3} onChange={(event) => setCommunityDetail({ ...communityDetail, description: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={communityDetail.isPublic} onChange={(event) => setCommunityDetail({ ...communityDetail, isPublic: event.target.checked })} /> ציבורית
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={communityDetail.isPilot} onChange={(event) => setCommunityDetail({ ...communityDetail, isPilot: event.target.checked })} /> pilot
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    סטטוס
                    <select value={communityDetail.status} onChange={(event) => setCommunityDetail({ ...communityDetail, status: event.target.value })} className="rounded-xl border border-slate-300 px-3 py-2">
                      <option value="active">active</option>
                      <option value="hidden">hidden</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black">הזמנות קהילה</h3>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="text-sm font-bold text-slate-700">ימים <input type="number" min={1} value={inviteDays} onChange={(event) => setInviteDays(Number(event.target.value) || 30)} className="ml-2 w-20 rounded-lg border border-slate-300 px-2 py-1" /></label>
                    <label className="text-sm font-bold text-slate-700">מקסימום שימושים <input type="number" min={0} value={inviteMaxUses} onChange={(event) => setInviteMaxUses(Number(event.target.value) || 0)} className="ml-2 w-20 rounded-lg border border-slate-300 px-2 py-1" /></label>
                    <button type="button" onClick={generateInvite} className="rounded-xl bg-blue-700 px-4 py-2 font-black text-white">צור קישור הזמנה</button>
                  </div>
                  {invitations.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {invitations.map((invitation) => (
                        <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm text-slate-700">
                            <span className="font-black">{invitation.invite_type}</span>
                            {invitation.revoked_at ? <span className="mr-2 text-red-700">בוטלה</span> : <span className="mr-2 text-emerald-700">פעילה</span>}
                            {invitation.expires_at ? <span className="mr-2">תפוגה: {new Date(invitation.expires_at).toLocaleDateString("he-IL")}</span> : null}
                            {invitation.max_uses ? <span className="mr-2">מקסימום: {invitation.max_uses}</span> : null}
                          </div>
                          {!invitation.revoked_at ? (
                            <button type="button" onClick={() => revokeInvite(invitation.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-black text-red-700">בטל</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">עדיין אין הזמנות לקהילה.</p>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black">בקשות חברות</h3>
                  {pendingRequests.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {pendingRequests.map((membership) => (
                        <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm text-slate-700">
                            <span className="font-black">{membership.user?.name ?? "משתמש"}</span>
                            {membership.user?.email ? <span className="mr-2">{membership.user.email}</span> : null}
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => approveMembership(membership.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-black text-white">אשר</button>
                            <button type="button" onClick={() => rejectMembership(membership.id)} className="rounded-lg bg-red-600 px-3 py-1.5 font-black text-white">דחה</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">אין בקשות ממתינות.</p>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black">חברים בקהילה</h3>
                  {members.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {members.map((membership) => (
                        <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm text-slate-700">
                            <span className="font-black">{membership.user?.name ?? "משתמש"}</span>
                            {membership.user?.email ? <span className="mr-2">{membership.user.email}</span> : null}
                            <span className="mr-2">{membership.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">עדיין אין חברים.</p>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black">הוספת חברים ידנית</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="חיפוש משתמש" className="min-w-[220px] rounded-xl border border-slate-300 px-3 py-2" />
                    <button type="button" onClick={searchUsers} className="rounded-xl bg-slate-800 px-4 py-2 font-black text-white">חפש</button>
                  </div>
                  {userResults.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {userResults.map((user) => (
                        <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm text-slate-700">
                            <span className="font-black">{user.name}</span>
                            {user.email ? <span className="mr-2">{user.email}</span> : null}
                          </div>
                          <button type="button" onClick={() => manualAddMember(user.id)} className="rounded-lg bg-violet-700 px-3 py-1.5 font-black text-white">הוסף</button>
                        </div>
                      ))}
                    </div>
                  ) : userSearch.trim() ? <p className="mt-3 text-sm text-slate-500">אין תוצאות.</p> : null}
                </div>
              </>
            ) : (
              <p className="font-bold text-slate-500">בחר קהילה כדי לנהל את פרטיה.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
