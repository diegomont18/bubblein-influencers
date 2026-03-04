import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Profile Enricher", href: "/dashboard/enricher" },
  { label: "Casting", href: "/dashboard/casting" },
  { label: "Monitoring", href: "/dashboard/monitoring" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen font-[family-name:var(--font-geist-sans)]">
      <aside className="w-64 bg-gray-900 text-gray-100 p-6 flex flex-col">
        <h2 className="text-lg font-semibold mb-6">Influencer Intel</h2>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-700 pt-4">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
