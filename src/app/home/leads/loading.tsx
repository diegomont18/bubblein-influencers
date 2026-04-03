export default function LeadsLoading() {
  return (
    <div className="space-y-8 cursor-wait">
      <div className="relative">
        <h1 className="text-4xl font-extrabold text-white tracking-tight font-[family-name:var(--font-lexend)]">
          Leads
        </h1>
        <p className="mt-2 text-[#adaaaa] max-w-xl font-[family-name:var(--font-be-vietnam-pro)]">
          Encontre leads qualificados a partir de quem engajou com posts no LinkedIn.
        </p>
      </div>
      <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-4 w-48 bg-[#20201f] rounded animate-pulse" />
          <div className="ml-auto h-7 w-24 bg-[#20201f] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
          <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
          <div className="h-24 bg-[#20201f] rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl bg-[#131313] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-4 w-56 bg-[#20201f] rounded animate-pulse" />
          <div className="ml-auto h-7 w-24 bg-[#20201f] rounded-lg animate-pulse" />
        </div>
        <div className="h-28 bg-[#20201f] rounded-xl animate-pulse" />
      </div>
      <div className="h-12 bg-[#20201f] rounded-full animate-pulse" />
    </div>
  );
}
