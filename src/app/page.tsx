import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      <main className="text-center space-y-8 px-4">
        <Image
          src="/logo.png"
          alt="BubbleIn"
          width={187}
          height={67}
          className="mx-auto"
          priority
        />
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Discover, evaluate, and monitor LinkedIn influencers with BubbleIn.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-purple-600 px-6 py-3 text-white font-medium hover:bg-purple-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </main>
    </div>
  );
}
