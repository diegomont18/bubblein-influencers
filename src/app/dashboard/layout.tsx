import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const navTop = [
  { label: "Overview", href: "/dashboard" },
  { label: "Users", href: "/dashboard/users" },
  { label: "API Costs", href: "/dashboard/api-costs" },
];

const navItems = [
  { label: "Casting", href: "/dashboard/casting", soon: false },
  { label: "Checker", href: "/dashboard/checker", soon: false },
  { label: "Profile Enricher", href: "/dashboard/enricher", soon: false },
  { label: "Buscas", href: "/dashboard/buscas", soon: false },
  { label: "Blog Posts", href: "/dashboard/blog-posts", soon: false },
  { label: "Monitoring", href: "/dashboard/monitoring", soon: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen font-[family-name:var(--font-geist-sans)]">
      <aside className="w-64 bg-gray-900 text-gray-100 p-6 flex flex-col">
        <img
          src="/logo.png"
          alt="BubbleIn"
          width={140}
          height={50}
          className="mb-6"
        />
        <nav className="flex-1">
          <div className="space-y-1">
            {navTop.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-gray-700 my-3" />
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
              >
                {item.label}
                {item.soon && (
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white leading-none">
                    Soon
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
        <div className="border-t border-gray-700 pt-4">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
