import { getBlogPosts } from "@/lib/contentful";

export const dynamic = "force-dynamic";

export default async function BlogPostsPage() {
  const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
  const { posts } = await getBlogPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage blog posts. Editing opens Contentful.
          </p>
        </div>
        <a
          href={`https://app.contentful.com/spaces/${SPACE_ID}/entries`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Create New Post
        </a>
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
            {posts.map((post) => (
              <tr
                key={post.sys.id}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {post.fields.title}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {post.fields.date ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-md truncate">
                  {post.fields.summary}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`https://app.contentful.com/spaces/${SPACE_ID}/entries/${post.sys.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
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
