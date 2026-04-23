"use client";

import React, { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  credits: number;
  credits_total: number;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserActivity {
  castingSearches: Array<{ id: string; name: string; query_theme: string; created_at: string }>;
  leadsScans: Array<{ id: string; post_urls: string[]; icp_job_titles: string[]; icp_departments: string[]; icp_company_size: string; total_engagers: number; matched_leads: number; status: string; created_at: string }>;
  lgProfiles: Array<{ id: string; linkedin_url: string; name: string; headline: string; created_at: string }>;
  recentCosts: Array<{ provider: string; operation: string; estimated_cost: number; source: string; metadata: Record<string, unknown> | null; created_at: string }>;
  costsByProvider: Record<string, number>;
  totalCost: number;
}

interface DailyReport {
  id: string;
  period_start: string;
  period_end: string;
  report_type: string;
  data: {
    newUsers: Array<{ email: string; created_at: string; role: string }>;
    castingSearches: Array<{ user_email: string; name: string; query_theme: string; created_at: string }>;
    leadsScans: Array<{ user_email: string; total_engagers: number; matched_leads: number; created_at: string }>;
    lgProfiles: Array<{ user_email: string; name: string; linkedin_url: string; created_at: string }>;
    apiCosts: { total: number; byProvider: Record<string, number>; bySource: Record<string, number> };
    summary: { newUsersCount: number; totalActions: number; totalCostUsd: number; totalCostBrl: number };
  };
  sent_at: string | null;
  created_at: string;
}

interface PendingCredit {
  id: string;
  email: string;
  extra_credits: number;
  claimed: boolean;
  claimed_at: string | null;
  created_at: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newExtraCredits, setNewExtraCredits] = useState(0);
  const [creating, setCreating] = useState(false);

  const [mainTab, setMainTab] = useState<"users" | "reports">("users");
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userActivities, setUserActivities] = useState<Record<string, UserActivity>>({});
  const [activityLoading, setActivityLoading] = useState<string | null>(null);

  // Pending credits
  const [pendingCredits, setPendingCredits] = useState<PendingCredit[]>([]);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingExtra, setPendingExtra] = useState(0);
  const [pendingCreating, setPendingCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users ?? []);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/pending-credits");
      const data = await res.json();
      if (res.ok) setPendingCredits(data.pendingCredits ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPendingCredits();
  }, [fetchUsers, fetchPendingCredits]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
          extraCredits: newExtraCredits,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewExtraCredits(0);
      setShowCreate(false);
      fetchUsers();
      fetchPendingCredits();
    } catch {
      setError("Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const newCredits = role === "admin" ? -1 : 3;
      await fetch(`/api/users/${userId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: newCredits }),
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, role, credits: newCredits, credits_total: newCredits }
            : u
        )
      );
    } catch {
      setError("Failed to update role");
    }
  }

  async function handleCreditsChange(userId: string, credits: number) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, credits: data.credits ?? credits, credits_total: data.credits_total ?? u.credits_total }
            : u
        )
      );
    } catch {
      setError("Failed to update credits");
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Delete user ${email}?`)) return;
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      fetchUsers();
    } catch {
      setError("Failed to delete user");
    }
  }

  async function toggleUserActivity(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!userActivities[userId]) {
      setActivityLoading(userId);
      try {
        const res = await fetch(`/api/dashboard/user-activity?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setUserActivities((prev) => ({ ...prev, [userId]: data }));
        }
      } catch { /* ignore */ }
      finally { setActivityLoading(null); }
    }
  }

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/dashboard/daily-reports?type=daily&limit=90");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } catch { /* ignore */ }
    finally { setReportsLoading(false); }
  }, []);

  useEffect(() => { if (mainTab === "reports" && reports.length === 0) fetchReports(); }, [mainTab, reports.length, fetchReports]);

  async function handleCreatePending(e: React.FormEvent) {
    e.preventDefault();
    setPendingCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/pending-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, extraCredits: pendingExtra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPendingEmail("");
      setPendingExtra(0);
      fetchPendingCredits();
    } catch { setError("Failed to create pending credits"); }
    finally { setPendingCreating(false); }
  }

  async function handleDeletePending(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/pending-credits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setPendingCredits((prev) => prev.filter((p) => p.id !== id));
      else { const data = await res.json(); setError(data.error); }
    } catch { setError("Failed to delete"); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  // Group reports by week/month for aggregated views
  function groupReports(period: "weekly" | "monthly") {
    const groups: Record<string, { label: string; reports: DailyReport[]; summary: DailyReport["data"]["summary"] }> = {};
    for (const r of reports) {
      const d = new Date(r.period_start);
      const key = period === "weekly"
        ? `${d.getFullYear()}-W${String(Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = period === "weekly"
        ? `Semana de ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
        : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = { label, reports: [], summary: { newUsersCount: 0, totalActions: 0, totalCostUsd: 0, totalCostBrl: 0 } };
      groups[key].reports.push(r);
      groups[key].summary.newUsersCount += r.data.summary.newUsersCount;
      groups[key].summary.totalActions += r.data.summary.totalActions;
      groups[key].summary.totalCostUsd += r.data.summary.totalCostUsd;
      groups[key].summary.totalCostBrl += r.data.summary.totalCostBrl;
    }
    return Object.values(groups).slice(0, period === "weekly" ? 12 : 6);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage users, roles, and credits.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {showCreate ? "Cancel" : "Create User"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setMainTab("users")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Usuarios</button>
        <button onClick={() => setMainTab("reports")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "reports" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Relatorios</button>
      </div>

      {mainTab === "users" && (<>
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Create New User
          </h3>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Extra Credits</label>
              <input
                type="number"
                value={newExtraCredits}
                onChange={(e) => setNewExtraCredits(Number(e.target.value))}
                min={0}
                placeholder="0"
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Credits</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Spent</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Injected</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Last Login</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isAdmin = user.credits === -1;
              const spent = isAdmin ? 0 : Math.max(0, user.credits_total - user.credits);
              const isExpanded = expandedUser === user.id;
              const activity = userActivities[user.id];
              return (
                <React.Fragment key={user.id}>
                <tr
                  className={`border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : ""}`}
                  onClick={() => toggleUserActivity(user.id)}
                  title="Clique para ver atividade"
                >
                  <td className="px-4 py-3 text-gray-900">
                    <span className="flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform shrink-0 text-gray-400 ${isExpanded ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                      {user.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span
                      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Ilimitado
                      </span>
                    ) : (
                      <input
                        type="number"
                        value={user.credits}
                        onChange={(e) =>
                          setUsers((prev) =>
                            prev.map((u) =>
                              u.id === user.id
                                ? { ...u, credits: Number(e.target.value) }
                                : u
                            )
                          )
                        }
                        onBlur={(e) =>
                          handleCreditsChange(user.id, Number(e.target.value))
                        }
                        onClick={(e) => e.stopPropagation()}
                        min={0}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {isAdmin ? (
                      <span className="text-purple-500 text-xs">—</span>
                    ) : (
                      <span className={`text-xs ${spent > 0 ? "text-orange-600 font-medium" : "text-gray-400"}`}>
                        {spent}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {isAdmin ? (
                      <span className="text-purple-500 text-xs">—</span>
                    ) : (
                      <span className="text-xs text-gray-600">{user.credits_total}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(user.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(user.id, user.email ?? ""); }}
                      className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      {activityLoading === user.id ? (
                        <p className="text-xs text-gray-400">Carregando atividade...</p>
                      ) : !activity ? (
                        <p className="text-xs text-gray-400">Sem dados</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Casting Searches */}
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                              Buscas Casting ({activity.castingSearches.length})
                            </h4>
                            {activity.castingSearches.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhuma busca</p>
                            ) : (
                              <div className="space-y-1.5">
                                {activity.castingSearches.map((s) => (
                                  <div key={s.id} className="flex items-start gap-2 text-xs">
                                    <span className="text-gray-400 whitespace-nowrap shrink-0">{formatDate(s.created_at)}</span>
                                    <div>
                                      <span className="text-gray-800 font-medium">{s.name || "Sem nome"}</span>
                                      {s.query_theme && <span className="ml-1.5 text-gray-500">— {s.query_theme}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Leads Scans */}
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                              Scans de Leads ({activity.leadsScans.length})
                            </h4>
                            {activity.leadsScans.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhum scan</p>
                            ) : (
                              <div className="space-y-2">
                                {activity.leadsScans.map((s) => (
                                  <div key={s.id} className="text-xs border-b border-gray-100 pb-1.5 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</span>
                                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.status === "complete" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{s.status}</span>
                                      <span className="text-gray-600">{s.matched_leads ?? 0} leads / {s.total_engagers ?? 0} engajadores</span>
                                    </div>
                                    {s.icp_job_titles?.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {s.icp_job_titles.slice(0, 5).map((t) => (
                                          <span key={t} className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">{t}</span>
                                        ))}
                                        {s.icp_company_size && <span className="bg-purple-50 text-purple-700 text-[10px] px-1.5 py-0.5 rounded">{s.icp_company_size}</span>}
                                      </div>
                                    )}
                                    {s.post_urls?.length > 0 && (
                                      <p className="text-[10px] text-gray-400 mt-0.5">{s.post_urls.length} post(s) analisados</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Profiles */}
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                              Perfis Analisados ({activity.lgProfiles.length})
                            </h4>
                            {activity.lgProfiles.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhum perfil</p>
                            ) : (
                              <div className="space-y-1.5">
                                {activity.lgProfiles.map((p) => (
                                  <div key={p.id} className="flex items-start gap-2 text-xs">
                                    <span className="text-gray-400 whitespace-nowrap shrink-0">{formatDate(p.created_at)}</span>
                                    <div>
                                      <span className="text-gray-800 font-medium">{p.name || "Sem nome"}</span>
                                      {p.headline && <span className="ml-1.5 text-gray-500 text-[10px]">— {p.headline.slice(0, 60)}</span>}
                                      {p.linkedin_url && <p className="text-[10px] text-blue-500 truncate max-w-[250px]">{p.linkedin_url}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Costs */}
                          <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                              Custos API — Total: ${activity.totalCost.toFixed(4)} (R${(activity.totalCost * 5).toFixed(2)})
                            </h4>
                            {Object.keys(activity.costsByProvider).length === 0 ? (
                              <p className="text-xs text-gray-400">Sem custos registrados</p>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-3 mb-2">
                                  {Object.entries(activity.costsByProvider).map(([prov, cost]) => (
                                    <span key={prov} className="text-xs">
                                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mr-1 ${prov === "apify" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>{prov}</span>
                                      ${cost.toFixed(4)}
                                    </span>
                                  ))}
                                </div>
                                {activity.recentCosts.slice(0, 5).map((c, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs border-b border-gray-100 pb-1 last:border-0">
                                    <span className="text-gray-400 whitespace-nowrap shrink-0">{formatDate(c.created_at)}</span>
                                    <span className="text-gray-600 font-mono">{c.operation}</span>
                                    <span className="text-gray-800">${Number(c.estimated_cost).toFixed(4)}</span>
                                    {c.metadata && (
                                      <span className="text-gray-400 text-[10px] truncate max-w-[200px]">
                                        {Object.entries(c.metadata).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Credits Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Pre-registration Credits</h2>
        <p className="text-sm text-gray-500">
          Allocate extra credits to emails before they sign up. When they register, these credits are added on top of the default 5.
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <form onSubmit={handleCreatePending} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={pendingEmail}
                onChange={(e) => setPendingEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Extra Credits</label>
              <input
                type="number"
                value={pendingExtra}
                onChange={(e) => setPendingExtra(Number(e.target.value))}
                required
                min={1}
                className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={pendingCreating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pendingCreating ? "Adding..." : "Add Credits"}
            </button>
          </form>
        </div>

        {pendingCredits.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Extra Credits</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCredits.map((pc) => (
                  <tr key={pc.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-900">{pc.email}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">+{pc.extra_credits}</td>
                    <td className="px-4 py-3">
                      {pc.claimed ? (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Claimed {pc.claimed_at ? formatDate(pc.claimed_at) : ""}
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(pc.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!pc.claimed && (
                        <button
                          onClick={() => handleDeletePending(pc.id)}
                          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}

      {/* Reports Tab */}
      {mainTab === "reports" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button key={p} onClick={() => setReportPeriod(p)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reportPeriod === p ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
                  {p === "daily" ? "Diario" : p === "weekly" ? "Semanal" : "Mensal"}
                </button>
              ))}
            </div>
            <button onClick={fetchReports} className="text-xs text-blue-600 hover:underline">Atualizar</button>
          </div>

          {reportsLoading ? (
            <p className="text-gray-400 text-sm py-8 text-center">Carregando relatorios...</p>
          ) : reportPeriod === "daily" ? (
            <div className="space-y-3">
              {reports.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Nenhum relatorio encontrado</p>}
              {reports.map((r) => {
                const isExp = expandedReport === r.id;
                const s = r.data.summary;
                return (
                  <div key={r.id} className={`rounded-lg border bg-white overflow-hidden ${isExp ? "border-blue-300" : "border-gray-200"}`}>
                    <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => setExpandedReport(isExp ? null : r.id)}>
                      <div className="flex items-center gap-3">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform text-gray-400 ${isExp ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6"/></svg>
                        <span className="text-sm font-medium text-gray-900">{formatDate(r.period_start)}</span>
                        {r.sent_at && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">enviado</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span><strong className="text-gray-900">{s.newUsersCount}</strong> novos</span>
                        <span><strong className="text-gray-900">{s.totalActions}</strong> acoes</span>
                        <span><strong className="text-gray-900">${s.totalCostUsd.toFixed(4)}</strong> (R${s.totalCostBrl.toFixed(2)})</span>
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-4 py-4 border-t border-gray-100 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Novos Users</p>
                            <p className="text-xl font-bold text-gray-900">{s.newUsersCount}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Acoes</p>
                            <p className="text-xl font-bold text-gray-900">{s.totalActions}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Custo USD</p>
                            <p className="text-xl font-bold text-gray-900">${s.totalCostUsd.toFixed(4)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Custo BRL</p>
                            <p className="text-xl font-bold text-gray-900">R${s.totalCostBrl.toFixed(2)}</p>
                          </div>
                        </div>
                        {r.data.newUsers.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Novos usuarios</p>
                            {r.data.newUsers.map((u) => <p key={u.email} className="text-xs text-gray-500">{u.email} ({u.role}) — {formatDate(u.created_at)}</p>)}
                          </div>
                        )}
                        {r.data.castingSearches.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Buscas Casting ({r.data.castingSearches.length})</p>
                            {r.data.castingSearches.map((c, i) => <p key={i} className="text-xs text-gray-500">{c.user_email} — {c.query_theme || c.name} — {formatDate(c.created_at)}</p>)}
                          </div>
                        )}
                        {r.data.leadsScans.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Scans de Leads ({r.data.leadsScans.length})</p>
                            {r.data.leadsScans.map((l, i) => <p key={i} className="text-xs text-gray-500">{l.user_email} — {l.total_engagers} engaj, {l.matched_leads} leads — {formatDate(l.created_at)}</p>)}
                          </div>
                        )}
                        {r.data.lgProfiles.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Perfis Analisados ({r.data.lgProfiles.length})</p>
                            {r.data.lgProfiles.map((p, i) => <p key={i} className="text-xs text-gray-500">{p.user_email} — {p.name} — {formatDate(p.created_at)}</p>)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Custos por Provider</p>
                          <div className="flex gap-3 text-xs text-gray-500">
                            {Object.entries(r.data.apiCosts.byProvider).map(([p, c]) => <span key={p}>{p}: ${c.toFixed(4)}</span>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {groupReports(reportPeriod).map((g) => (
                <div key={g.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{g.label} <span className="text-xs text-gray-400">({g.reports.length} relatorios)</span></span>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span><strong className="text-gray-900">{g.summary.newUsersCount}</strong> novos</span>
                      <span><strong className="text-gray-900">{g.summary.totalActions}</strong> acoes</span>
                      <span><strong className="text-gray-900">${g.summary.totalCostUsd.toFixed(4)}</strong> (R${g.summary.totalCostBrl.toFixed(2)})</span>
                    </div>
                  </div>
                </div>
              ))}
              {groupReports(reportPeriod).length === 0 && <p className="text-gray-400 text-sm py-8 text-center">Nenhum relatorio encontrado</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
