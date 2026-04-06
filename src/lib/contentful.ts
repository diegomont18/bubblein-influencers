import {
  createClient,
  type ContentfulClientApi,
  type EntryFieldTypes,
  type EntrySkeletonType,
  type Entry,
  type Asset,
} from "contentful";

let _client: ContentfulClientApi<undefined> | null = null;

function isConfigured() {
  return !!(process.env.CONTENTFUL_SPACE_ID && process.env.CONTENTFUL_ACCESS_TOKEN);
}

function getClient() {
  if (!_client) {
    _client = createClient({
      space: process.env.CONTENTFUL_SPACE_ID!,
      accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
    });
  }
  return _client;
}

type BlogPostSkeleton = EntrySkeletonType<
  {
    title: EntryFieldTypes.Text;
    slug: EntryFieldTypes.Text;
    date: EntryFieldTypes.Date;
    summary: EntryFieldTypes.Text;
    content: EntryFieldTypes.RichText;
    image: EntryFieldTypes.AssetLink;
    author: EntryFieldTypes.Text;
  },
  "bubbleInBlog"
>;

export type BlogPostEntry = Entry<
  BlogPostSkeleton,
  "WITHOUT_UNRESOLVABLE_LINKS"
>;

const POSTS_PER_PAGE = 6;

export interface PaginatedPosts {
  posts: BlogPostEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getBlogPosts(page = 1): Promise<PaginatedPosts> {
  if (!isConfigured()) return { posts: [], total: 0, page: 1, totalPages: 0 };
  const skip = (page - 1) * POSTS_PER_PAGE;
  const query = {
    content_type: "bubbleInBlog" as const,
    order: ["-fields.date"],
    "fields.date[lte]": new Date().toISOString(),
    limit: POSTS_PER_PAGE,
    skip,
    include: 1 as const,
  };
  // @ts-expect-error Contentful SDK types don't support fields.* in order/filter but the API does
  const entries = await getClient().withoutUnresolvableLinks.getEntries<BlogPostSkeleton>(query);
  return {
    posts: entries.items,
    total: entries.total,
    page,
    totalPages: Math.ceil(entries.total / POSTS_PER_PAGE),
  };
}

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPostEntry | null> {
  if (!isConfigured()) return null;
  const entries = await getClient().withoutUnresolvableLinks.getEntries<BlogPostSkeleton>({
    content_type: "bubbleInBlog",
    "fields.slug": slug,
    limit: 1,
    include: 1,
  });
  return entries.items[0] ?? null;
}

export async function getAllBlogSlugs(): Promise<BlogPostEntry[]> {
  if (!isConfigured()) return [];
  const slugQuery = {
    content_type: "bubbleInBlog" as const,
    select: ["fields.slug", "sys.updatedAt"],
    order: ["-fields.date"],
    "fields.date[lte]": new Date().toISOString(),
    limit: 1000,
  };
  // @ts-expect-error Contentful SDK types don't support fields.* in order/select/filter but the API does
  const entries = await getClient().withoutUnresolvableLinks.getEntries<BlogPostSkeleton>(slugQuery);
  return entries.items;
}

export function getImageUrl(asset: Asset<"WITHOUT_UNRESOLVABLE_LINKS", string> | undefined): string | null {
  if (!asset?.fields?.file) return null;
  const url = asset.fields.file.url;
  return url?.startsWith("//") ? `https:${url}` : url ?? null;
}
