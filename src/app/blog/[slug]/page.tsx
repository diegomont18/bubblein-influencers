import { createReader } from "@keystatic/core/reader";
import Markdoc from "@markdoc/markdoc";
import React from "react";
import config from "../../../../keystatic.config";
import Link from "next/link";
import Image from "next/image";

const reader = createReader(process.cwd(), config);

export async function generateStaticParams() {
  const slugs = await reader.collections.posts.list();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const post = await reader.collections.posts.read(params.slug);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.title} - BubbleIn Blog`,
    description: post.summary,
  };
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await reader.collections.posts.read(params.slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0B0B1A] text-white flex items-center justify-center">
        <p>Post not found.</p>
      </div>
    );
  }

  const ast = await post.content();
  const transformed = Markdoc.transform(ast as unknown as Parameters<typeof Markdoc.transform>[0]);
  const rendered = Markdoc.renderers.react(transformed, React);

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <nav className="bg-[#0B0B1A]/80 backdrop-blur-lg border-b border-[#1E1E3A] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="BubbleIn" width={120} height={43} priority />
          </Link>
          <Link
            href="/blog"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Voltar ao blog
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-20">
        <time className="text-sm text-[#E91E8C] font-medium">
          {new Date(post.date).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="text-3xl md:text-5xl font-bold mt-3 mb-4">
          {post.title}
        </h1>
        <p className="text-gray-400 text-lg mb-10">{post.summary}</p>
        <div className="prose prose-pink max-w-none">{rendered}</div>
      </article>
    </div>
  );
}
