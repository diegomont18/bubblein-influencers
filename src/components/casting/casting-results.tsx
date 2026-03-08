"use client";

export interface CastingProfile {
  slug: string;
  name: string;
  headline: string;
  job_title: string;
  company: string;
  location: string;
  followers: number;
  posts_per_month: number;
  linkedin_url: string;
}

interface CastingResultsProps {
  profiles: CastingProfile[];
}

export function CastingResults({ profiles }: CastingResultsProps) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    disabled
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
                <th className="px-4 py-3 font-medium text-gray-500">Headline</th>
                <th className="px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="px-4 py-3 font-medium text-gray-500">Current Job</th>
                <th className="px-4 py-3 font-medium text-gray-500">Followers</th>
                <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
                <th className="px-4 py-3 font-medium text-gray-500">Tags</th>
                <th className="px-4 py-3 font-medium text-gray-500">Posts /month</th>
                <th className="px-4 py-3 font-medium text-gray-500">Extracted</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                  No profiles found matching your criteria.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  disabled
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Profile</th>
              <th className="px-4 py-3 font-medium text-gray-500">Headline</th>
              <th className="px-4 py-3 font-medium text-gray-500">Company</th>
              <th className="px-4 py-3 font-medium text-gray-500">Current Job</th>
              <th className="px-4 py-3 font-medium text-gray-500">Followers</th>
              <th className="px-4 py-3 font-medium text-gray-500">Topics</th>
              <th className="px-4 py-3 font-medium text-gray-500">Tags</th>
              <th className="px-4 py-3 font-medium text-gray-500">Posts /month</th>
              <th className="px-4 py-3 font-medium text-gray-500">Extracted</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const slug = p.linkedin_url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] ?? p.slug;
              return (
                <tr
                  key={p.slug}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      disabled
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-blue-600">
                    {p.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.linkedin_url ? (
                      <a
                        href={p.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        /{slug}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-600">
                    {p.headline || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.job_title || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.followers != null ? p.followers.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className={`px-4 py-3 ${(p.posts_per_month ?? 0) < 3 ? "text-red-600" : "text-gray-600"}`}>
                    {p.posts_per_month != null ? String(Math.round(p.posts_per_month)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      found
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
