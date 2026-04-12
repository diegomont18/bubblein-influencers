"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  credits: number;
  credits_total: number;
  created_at: string;
  last_sign_in_at: string | null;
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
              return (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 text-gray-900">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
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
                      onClick={() => handleDelete(user.id, user.email ?? "")}
                      className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
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
    </div>
  );
}
