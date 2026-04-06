import { getBlogPosts, getImageUrl } from "@/lib/contentful";
import Navbar from "@/components/navbar";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog",
  description:
    "Conteúdos sobre marketing de influência B2B no LinkedIn. Dicas, estratégias e cases para sua marca crescer.",
  alternates: {
    canonical: "/blog",
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { posts, totalPages } = await getBlogPosts(page);

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-28 pb-20">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">Blog</span>
        </h1>
        <p className="text-gray-400 mb-12 text-lg">
          Conteúdos sobre marketing de influência B2B no LinkedIn.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-500">Nenhum post publicado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const imageUrl = getImageUrl(post.fields.image);
              return (
                <Link
                  key={post.sys.id}
                  href={`/blog/${post.fields.slug}`}
                  className="block bg-[#12122A] border border-[#1E1E3A] rounded-2xl overflow-hidden hover:border-[#E91E8C]/30 transition-colors"
                >
                  {imageUrl && (
                    <div className="relative w-full aspect-[4/3]">
                      <Image
                        src={imageUrl}
                        alt={post.fields.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h2 className="text-base font-bold mb-2 line-clamp-2">
                      {post.fields.title}
                    </h2>
                    {post.fields.author && (
                      <p className="text-sm text-gray-400 mb-1">{post.fields.author}</p>
                    )}
                    <time className="text-sm text-gray-500">
                      {new Date(post.fields.date).toLocaleDateString("pt-BR", {
                        year: "2-digit",
                        month: "numeric",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-12">
            {page > 1 && (
              <Link
                href={`/blog?page=${page - 1}`}
                className="px-4 py-2 rounded-lg border border-[#1E1E3A] text-sm text-gray-400 hover:text-white hover:border-[#E91E8C]/30 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            <span className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/blog?page=${page + 1}`}
                className="px-4 py-2 rounded-lg border border-[#1E1E3A] text-sm text-gray-400 hover:text-white hover:border-[#E91E8C]/30 transition-colors"
              >
                Próxima →
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
