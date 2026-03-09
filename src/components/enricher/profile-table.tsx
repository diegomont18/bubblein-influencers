"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Filters {
  name: string;
  topic: string;
  company: string;
  role: string;
  followers_min: string;
  followers_max: string;
  status: string;
  tag: string;
}

type EditableField =
  | "name"
  | "headline"
  | "company_current"
  | "role_current"
  | "current_job"
  | "followers_count"
  | "location"
  | "posting_frequency_score";

function EditableCell({
  profileId,
  field,
  value,
  isEdited,
  editingCell,
  onStartEdit,
  onSave,
  onCancel,
  editValue,
  onEditValueChange,
  className,
}: {
  profileId: string;
  field: string;
  value: string;
  isEdited: boolean;
  editingCell: { id: string; field: string } | null;
  onStartEdit: (id: string, field: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  editValue: string;
  onEditValueChange: (v: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing =
    editingCell?.id === profileId && editingCell?.field === field;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <td className={className}>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={onSave}
          className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </td>
    );
  }

  return (
    <td
      className={`${className} cursor-pointer`}
      onDoubleClick={() => onStartEdit(profileId, field, value)}
    >
      <span>{value}</span>
      {isEdited && (
        <span className="ml-1 text-[10px] text-gray-400">(edited)</span>
      )}
    </td>
  );
}

export function ProfileTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    name: "",
    topic: "",
    company: "",
    role: "",
    followers_min: "",
    followers_max: "",
    status: "done",
    tag: "",
  });

  // Sort state
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Re-enrich per-row state
  const [reEnrichingIds, setReEnrichingIds] = useState<Map<string, string>>(new Map());

  // Tag bulk action state
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const limit = 20;

  const fetchProfiles = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.name) params.set("name", filters.name);
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.company) params.set("company", filters.company);
    if (filters.role) params.set("role", filters.role);
    if (filters.followers_min) params.set("followers_min", filters.followers_min);
    if (filters.followers_max) params.set("followers_max", filters.followers_max);
    if (filters.status) params.set("status", filters.status);
    if (filters.tag) params.set("tag", filters.tag);
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("sort_dir", sortDir);
    }

    try {
      const res = await fetch(`/api/profiles?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.data);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filters, sortBy, sortDir]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Auto-refresh polling (silent, skips loading spinner)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!editingCell) {
        fetchProfiles(true);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchProfiles, editingCell]);

  // Fetch all tags for autocomplete
  useEffect(() => {
    fetch("/api/profiles/tags")
      .then((r) => r.json())
      .then((d) => setAllTags(d.tags ?? []))
      .catch(() => {});
  }, []);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  async function handleReEnrich(id: string) {
    const setStatus = (status: string) =>
      setReEnrichingIds((prev) => new Map(prev).set(id, status));
    const clearStatus = () =>
      setReEnrichingIds((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

    try {
      console.log(`[re-enrich] Queuing re-enrich for profile ${id}`);
      setStatus("Queuing...");
      const queueRes = await fetch(`/api/profiles/${id}/re-enrich`, { method: "POST" });
      console.log(`[re-enrich] Queue response for ${id}: ${queueRes.status}`);

      if (!queueRes.ok) {
        setStatus("Failed");
        setTimeout(clearStatus, 3000);
        return;
      }

      console.log(`[re-enrich] Triggering enrichment processing for ${id}`);
      setStatus("Enriching...");
      const processRes = await fetch("/api/enrichment/process", { method: "POST" });
      const processData = await processRes.json();
      console.log(`[re-enrich] Process response for ${id}:`, processData);

      const profileResult = processData.results?.find(
        (r: { profile_id: string }) => r.profile_id === id
      );
      const resultStatus = profileResult?.status === "done" ? "Done" : profileResult ? "Failed" : "Done";
      setStatus(resultStatus);

      await fetchProfiles();
      setTimeout(clearStatus, 3000);
    } catch (err) {
      console.error(`[re-enrich] Error for profile ${id}:`, err);
      setStatus("Failed");
      setTimeout(clearStatus, 3000);
    }
  }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === profiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(profiles.map((p) => p.id)));
    }
  }

  // Bulk tag operations
  async function handleBulkTag(action: "add" | "remove") {
    const tag = tagInput.trim();
    if (!tag || selected.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch("/api/profiles/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_ids: Array.from(selected),
          action,
          tags: [tag],
        }),
      });
      setTagInput("");
      // Refresh tags list and profiles
      const tagsRes = await fetch("/api/profiles/tags");
      const tagsData = await tagsRes.json();
      setAllTags(tagsData.tags ?? []);
      await fetchProfiles();
    } finally {
      setBulkLoading(false);
    }
  }

  // Inline add tag to single profile
  async function handleInlineAddTag(profileId: string) {
    const tag = prompt("Enter tag:");
    if (!tag?.trim()) return;
    await fetch("/api/profiles/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_ids: [profileId],
        action: "add",
        tags: [tag.trim()],
      }),
    });
    const tagsRes = await fetch("/api/profiles/tags");
    const tagsData = await tagsRes.json();
    setAllTags(tagsData.tags ?? []);
    fetchProfiles();
  }

  // Inline editing
  function handleStartEdit(id: string, field: string, value: string) {
    setEditingCell({ id, field });
    setEditValue(value === "—" ? "" : value);
  }

  async function handleSaveEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;

    // Get the original value for comparison
    const isNumeric = field === "followers_count" || field === "posting_frequency_score";
    const originalValue = isNumeric
      ? String((profile as Record<string, unknown>)[field] ?? "")
      : String((profile as Record<string, unknown>)[field] ?? "");

    // If unchanged, just cancel
    if (editValue === originalValue) {
      setEditingCell(null);
      return;
    }

    const body: Record<string, unknown> = {};
    if (field === "followers_count" || field === "posting_frequency_score") {
      body[field] = editValue ? parseFloat(editValue) : null;
    } else {
      body[field] = editValue || null;
    }

    // Optimistic update
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: body[field] };
        updated.edited_fields = Array.from(new Set([...p.edited_fields, field]));
        return updated;
      })
    );
    setEditingCell(null);

    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { profile: updatedProfile } = await res.json();
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? updatedProfile : p))
        );
      } else {
        // Revert on error
        await fetchProfiles();
      }
    } catch {
      await fetchProfiles();
    }
  }

  function handleCancelEdit() {
    setEditingCell(null);
  }

  async function handleToggleChecked(id: string, checked: boolean) {
    // Optimistic update
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, checked } : p))
    );
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
      if (!res.ok) {
        await fetchProfiles();
      }
    } catch {
      await fetchProfiles();
    }
  }

  // Delete profiles
  async function handleDeleteProfiles(ids: string[]) {
    const count = ids.length;
    const confirmed = confirm(
      `Delete ${count} profile${count !== 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_ids: ids }),
      });
      if (res.ok) {
        setSelected((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        await fetchProfiles();
      }
    } catch {
      // ignore
    }
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  }

  function SortableHeader({ column, label }: { column: string; label: string }) {
    const active = sortBy === column;
    return (
      <th
        className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
        onClick={() => handleSort(column)}
      >
        {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  const totalPages = Math.ceil(total / limit);

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (filters.name) params.set("name", filters.name);
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.company) params.set("company", filters.company);
    if (filters.role) params.set("role", filters.role);
    if (filters.followers_min) params.set("followers_min", filters.followers_min);
    if (filters.followers_max) params.set("followers_max", filters.followers_max);
    if (filters.status) params.set("status", filters.status);
    if (filters.tag) params.set("tag", filters.tag);
    window.open(`/api/profiles/export?${params}`, "_blank");
  }

  const filteredSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && t !== tagInput
  );

  function isFieldEdited(profile: Profile, field: string): boolean {
    return (profile.edited_fields ?? []).includes(field);
  }

  function cellValue(profile: Profile, field: EditableField): string {
    if (field === "followers_count") {
      return profile.followers_count != null
        ? String(profile.followers_count)
        : "—";
    }
    if (field === "posting_frequency_score") {
      return profile.posting_frequency_score != null
        ? String(profile.posting_frequency_score)
        : "—";
    }
    return (profile[field] as string) ?? "—";
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Name"
            value={filters.name}
            onChange={(e) => updateFilter("name", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            placeholder="Topic"
            value={filters.topic}
            onChange={(e) => updateFilter("topic", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            placeholder="Company"
            value={filters.company}
            onChange={(e) => updateFilter("company", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            placeholder="Role"
            value={filters.role}
            onChange={(e) => updateFilter("role", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            type="number"
            placeholder="Min followers"
            value={filters.followers_min}
            onChange={(e) => updateFilter("followers_min", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <input
            type="number"
            placeholder="Max followers"
            value={filters.followers_max}
            onChange={(e) => updateFilter("followers_max", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-32"
          />
          <select
            value={filters.tag}
            onChange={(e) => updateFilter("tag", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All tags</option>
            <option value="__none__">No tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCsv}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-700">
            {selected.size} selected
          </span>
          <div className="relative">
            <input
              placeholder="Tag name..."
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggestions(true);
              }}
              onFocus={() => setShowTagSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm w-40"
            />
            {showTagSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-40 rounded-md border border-gray-200 bg-white shadow-md max-h-32 overflow-y-auto">
                {filteredSuggestions.map((t) => (
                  <li
                    key={t}
                    onMouseDown={() => {
                      setTagInput(t);
                      setShowTagSuggestions(false);
                    }}
                    className="cursor-pointer px-3 py-1.5 text-sm hover:bg-gray-100"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => handleBulkTag("add")}
            disabled={bulkLoading || !tagInput.trim()}
            className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Add Tag
          </button>
          <button
            onClick={() => handleBulkTag("remove")}
            disabled={bulkLoading || !tagInput.trim()}
            className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Remove Tag
          </button>
          <button
            onClick={() => handleDeleteProfiles(Array.from(selected))}
            className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Count */}
      <div className="px-4 py-2 text-sm text-gray-600">
        {total} enriched profile{total !== 1 ? "s" : ""}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={profiles.length > 0 && selected.size === profiles.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <SortableHeader column="name" label="Name" />
              <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
              <th className="px-4 py-3 font-medium text-gray-500">Checked</th>
              <SortableHeader column="headline" label="Headline" />
              <SortableHeader column="company_current" label="Company" />
              <SortableHeader column="current_job" label="Current Job" />
              <SortableHeader column="followers_count" label="Followers" />
              <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
              <th className="px-4 py-3 font-medium text-gray-500">Tags</th>
              <SortableHeader column="posting_frequency_score" label="Posts /month" />
              <SortableHeader column="last_enriched_at" label="Extracted" />
              <SortableHeader column="enrichment_status" label="Status" />
              <th className="px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                  No profiles found
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <EditableCell
                    profileId={p.id}
                    field="name"
                    value={cellValue(p, "name")}
                    isEdited={isFieldEdited(p, "name")}
                    editingCell={editingCell}
                    onStartEdit={handleStartEdit}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className="px-4 py-3 text-blue-600"
                  />
                  <td className="px-4 py-3 text-gray-600">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        /{p.url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? "—"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!p.checked}
                      onChange={() => handleToggleChecked(p.id, !p.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <EditableCell
                    profileId={p.id}
                    field="headline"
                    value={cellValue(p, "headline")}
                    isEdited={isFieldEdited(p, "headline")}
                    editingCell={editingCell}
                    onStartEdit={handleStartEdit}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className="px-4 py-3 max-w-xs truncate text-gray-600"
                  />
                  <EditableCell
                    profileId={p.id}
                    field="company_current"
                    value={cellValue(p, "company_current")}
                    isEdited={isFieldEdited(p, "company_current")}
                    editingCell={editingCell}
                    onStartEdit={handleStartEdit}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className="px-4 py-3 text-gray-600"
                  />
                  <EditableCell
                    profileId={p.id}
                    field="current_job"
                    value={cellValue(p, "current_job")}
                    isEdited={isFieldEdited(p, "current_job")}
                    editingCell={editingCell}
                    onStartEdit={handleStartEdit}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className="px-4 py-3 text-gray-600"
                  />
                  <EditableCell
                    profileId={p.id}
                    field="followers_count"
                    value={p.followers_count != null ? p.followers_count.toLocaleString() : "—"}
                    isEdited={isFieldEdited(p, "followers_count")}
                    editingCell={editingCell}
                    onStartEdit={(id, field) =>
                      handleStartEdit(
                        id,
                        field,
                        p.followers_count != null ? String(p.followers_count) : ""
                      )
                    }
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className="px-4 py-3 text-gray-600"
                  />
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.topics ?? []).map((t) => (
                        <span
                          key={t}
                          className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 items-center">
                      {(p.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                        >
                          {t}
                        </span>
                      ))}
                      <button
                        onClick={() => handleInlineAddTag(p.id)}
                        className="inline-block rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-200"
                        title="Add tag"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <EditableCell
                    profileId={p.id}
                    field="posting_frequency_score"
                    value={p.posting_frequency_score != null ? String(p.posting_frequency_score) : "—"}
                    isEdited={isFieldEdited(p, "posting_frequency_score")}
                    editingCell={editingCell}
                    onStartEdit={(id, field) =>
                      handleStartEdit(
                        id,
                        field,
                        p.posting_frequency_score != null ? String(p.posting_frequency_score) : ""
                      )
                    }
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    editValue={editValue}
                    onEditValueChange={setEditValue}
                    className={`px-4 py-3 ${(p.posting_frequency_score ?? 0) < 3 ? "text-red-600" : "text-gray-600"}`}
                  />
                  <td className="px-4 py-3 text-gray-600">
                    {p.last_enriched_at
                      ? new Date(p.last_enriched_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.enrichment_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {reEnrichingIds.has(p.id) ? (
                        <span className="flex items-center gap-1.5 text-xs text-blue-600">
                          {reEnrichingIds.get(p.id) !== "Done" && reEnrichingIds.get(p.id) !== "Failed" && (
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {reEnrichingIds.get(p.id)}
                        </span>
                      ) : (p.enrichment_status === "done" ||
                        p.enrichment_status === "failed") ? (
                        <button
                          onClick={() => handleReEnrich(p.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Re-enrich
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDeleteProfiles([p.id])}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete profile"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end border-t border-gray-200 px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}
