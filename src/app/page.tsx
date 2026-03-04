import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      <main className="text-center space-y-8 px-4">
        <h1 className="text-4xl font-bold text-gray-900">
          Influencer Intelligence Platform
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Discover, evaluate, and monitor LinkedIn influencers for your brand
          campaigns.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </main>
    </div>
  );
}
