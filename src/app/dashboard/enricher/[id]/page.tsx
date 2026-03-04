import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ReEnrichButton } from "./re-enrich-button";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Experience = Database["public"]["Tables"]["profile_experiences"]["Row"];
type Job = Database["public"]["Tables"]["enrichment_jobs"]["Row"];

export default async function ProfileDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const service = createServiceClient();

  const { data: profileData } = await service
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  const profile = profileData as Profile | null;
  if (!profile) notFound();

  const { data: experienceData } = await service
    .from("profile_experiences")
    .select("*")
    .eq("profile_id", params.id)
    .order("start_date", { ascending: false });
  const experiences = (experienceData ?? []) as Experience[];

  const { data: jobData } = await service
    .from("enrichment_jobs")
    .select("*")
    .eq("profile_id", params.id)
    .order("queued_at", { ascending: false });
  const jobs = (jobData ?? []) as Job[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.name ?? "Unknown Profile"}
          </h1>
          <p className="mt-1 text-gray-600">{profile.headline ?? ""}</p>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            {profile.company_current && <span>{profile.company_current}</span>}
            {profile.role_current && <span>{profile.role_current}</span>}
            {profile.location && <span>{profile.location}</span>}
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            {profile.followers_count != null && (
              <span>{profile.followers_count.toLocaleString()} followers</span>
            )}
            {profile.connections_count != null && (
              <span>{profile.connections_count.toLocaleString()} connections</span>
            )}
            {profile.posting_frequency && (
              <span>Posts: {profile.posting_frequency}</span>
            )}
          </div>
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-blue-600 hover:underline"
          >
            View on LinkedIn
          </a>
        </div>
        <ReEnrichButton profileId={profile.id} />
      </div>

      {/* Topics */}
      {profile.topics && profile.topics.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-2">Topics</h2>
          <div className="flex flex-wrap gap-2">
            {profile.topics.map((t) => (
              <span
                key={t}
                className="inline-block rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* About */}
      {profile.about && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-2">About</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {profile.about}
          </p>
        </div>
      )}

      {/* Experience */}
      {experiences.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-3">Experience</h2>
          <div className="space-y-4">
            {experiences.map((exp) => (
              <div key={exp.id} className="border-l-2 border-gray-200 pl-4">
                <p className="font-medium text-gray-900">
                  {exp.role ?? "Unknown Role"}
                </p>
                <p className="text-sm text-gray-600">{exp.company ?? ""}</p>
                <p className="text-xs text-gray-400">
                  {exp.start_date ?? "?"} — {exp.is_current ? "Present" : (exp.end_date ?? "?")}
                </p>
                {exp.description && (
                  <p className="mt-1 text-sm text-gray-500">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrichment History */}
      {jobs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-3">
            Enrichment History
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Attempts</th>
                <th className="pb-2 font-medium">Queued</th>
                <th className="pb-2 font-medium">Completed</th>
                <th className="pb-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-gray-100">
                  <td className="py-2">{job.status}</td>
                  <td className="py-2">{job.attempt_count}</td>
                  <td className="py-2">{new Date(job.queued_at).toLocaleString()}</td>
                  <td className="py-2">
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-2 text-red-600">{job.last_error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw Data */}
      {profile.raw_data && (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer p-5 text-sm font-medium text-gray-900">
            Raw Data
          </summary>
          <pre className="overflow-x-auto p-5 pt-0 text-xs text-gray-600">
            {JSON.stringify(profile.raw_data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
