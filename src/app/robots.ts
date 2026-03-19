import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bubblein.com.br";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog"],
        disallow: ["/dashboard", "/login", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
