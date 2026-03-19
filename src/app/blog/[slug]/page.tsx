import { getBlogPostBySlug, getImageUrl } from "@/lib/contentful";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import Image from "next/image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug);
  if (!post) return { title: "Post não encontrado" };

  const imageUrl = getImageUrl(post.fields.image);

  return {
    title: post.fields.title,
    description: post.fields.summary,
    alternates: {
      canonical: `/blog/${post.fields.slug}`,
    },
    openGraph: {
      type: "article",
      title: post.fields.title,
      description: post.fields.summary,
      publishedTime: post.fields.date,
      authors: post.fields.author ? [post.fields.author] : undefined,
      ...(imageUrl && { images: [{ url: imageUrl, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.fields.title,
      description: post.fields.summary,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getBlogPostBySlug(params.slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0B0B1A] text-white flex items-center justify-center">
        <p>Post not found.</p>
      </div>
    );
  }

  const imageUrl = getImageUrl(post.fields.image);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.fields.title,
    description: post.fields.summary,
    datePublished: post.fields.date,
    ...(post.fields.author && {
      author: { "@type": "Person", name: post.fields.author },
    }),
    ...(imageUrl && { image: imageUrl }),
    publisher: {
      "@type": "Organization",
      name: "BubbleIn",
      logo: { "@type": "ImageObject", url: "/logo.png" },
    },
  };

  return (
    <div className="min-h-screen bg-[#0B0B1A] text-white font-[family-name:var(--font-geist-sans)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <article className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <div className="flex items-center gap-3 mb-4">
          <time className="text-sm text-[#E91E8C] font-medium">
            {new Date(post.fields.date).toLocaleDateString("pt-BR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.fields.author && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-sm text-gray-400">{post.fields.author}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          {post.fields.title}
        </h1>
        <p className="text-gray-400 text-lg mb-10">{post.fields.summary}</p>

        {imageUrl && (
          <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden mb-10">
            <Image
              src={imageUrl}
              alt={post.fields.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        <div className="prose prose-pink max-w-none">
          {documentToReactComponents(post.fields.content)}
        </div>
      </article>
    </div>
  );
}
