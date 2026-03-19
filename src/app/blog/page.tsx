import { createReader } from "@keystatic/core/reader";
import config from "../../../keystatic.config";
import Link from "next/link";
import Image from "next/image";

const reader = createReader(process.cwd(), config);

export const metadata = {
  title: "Blog - BubbleIn",
  description: "Conteúdos sobre marketing de influência B2B no LinkedIn.",
};

export default async function BlogPage() {
  const postSlugs = await reader.collections.posts.list();
  const posts = await Promise.all(
    postSlugs.map(async (slug) => {
      const post = await reader.collections.posts.read(slug);
      return { slug, ...post! };
    })
  );

  posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <nav className="bg-[#0B0B1A]/80 backdrop-blur-lg border-b border-[#1E1E3A] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="BubbleIn" width={120} height={43} priority />
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Voltar ao site
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-gradient">Blog</span>
        </h1>
        <p className="text-gray-400 mb-12 text-lg">
          Conteúdos sobre marketing de influência B2B no LinkedIn.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-500">Nenhum post publicado ainda.</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-[#12122A] border border-[#1E1E3A] rounded-2xl p-6 md:p-8 hover:border-[#E91E8C]/30 transition-colors"
              >
                <time className="text-sm text-[#E91E8C] font-medium">
                  {new Date(post.date).toLocaleDateString("pt-BR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="text-xl md:text-2xl font-bold mt-2 mb-3">
                  {post.title}
                </h2>
                <p className="text-gray-400 leading-relaxed">{post.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
