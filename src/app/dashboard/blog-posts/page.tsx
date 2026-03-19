import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "../../../../keystatic.config";
import Link from "next/link";

export default async function BlogPostsPage() {
  const reader = createReader(process.cwd(), keystaticConfig);
  const slugs = await reader.collections.posts.list();
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const post = await reader.collections.posts.read(slug);
      return post ? { slug, ...post } : null;
    })
  );

  const validPosts = posts
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date.localeCompare(a.date);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage blog posts. Editing opens the Keystatic editor.
          </p>
        </div>
        <Link
          href="/keystatic/collection/posts/create"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Create New Post
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                Title
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                Date
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">
                Summary
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {validPosts.map((post) => (
              <tr
                key={post.slug}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {post.title}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {post.date ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-md truncate">
                  {post.summary}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/keystatic/collection/posts/item/${post.slug}`}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {validPosts.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No posts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
