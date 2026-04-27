"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { CastingResultsView } from "@/components/casting/casting-results-view";
import { CastingProfile } from "@/components/casting/casting-results";

interface ShareData {
  profiles: (CastingProfile & { campaign_id?: string | null })[];
  campaigns: { id: string; name: string }[];
  share: {
    label: string | null;
    campaignId: string | null;
    campaignName: string | null;
  };
}

export default function SharedPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCampaignId, setFilterCampaignId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shares/${token}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json.error ?? "Link não encontrado ou expirado");
          return;
        }
        const json = await res.json();
        setData(json);
        if (json.share.campaignId) {
          setFilterCampaignId(json.share.campaignId);
        }
      } catch {
        setError("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const filteredProfiles = useMemo(() => {
    if (!data) return [];
    if (!filterCampaignId) return data.profiles;
    return data.profiles.filter((p) => p.campaign_id === filterCampaignId);
  }, [data, filterCampaignId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-[#adaaaa] text-sm animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-[#ff946e] text-lg font-semibold">{error ?? "Link inválido"}</div>
          <p className="text-[#adaaaa] text-sm">Este link de compartilhamento não existe ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const title = data.share.label
    ? data.share.label
    : data.share.campaignName
    ? `Campanha: ${data.share.campaignName}`
    : "Todos os Creators";

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="border-b border-[#262626] bg-[#131313]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Image src="/bubblein-blackbg-logo-influencers-b2b.png" alt="BubbleIn" width={105} height={28} />
          <span className="text-xs text-[#adaaaa] font-[family-name:var(--font-lexend)]">
            Compartilhado via BubbleIn
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <CastingResultsView
          profiles={filteredProfiles}
          campaigns={data.share.campaignId ? [] : data.campaigns}
          filterCampaignId={filterCampaignId}
          onFilterCampaignChange={setFilterCampaignId}
          title={title}
          readOnly
        />
      </main>
    </div>
  );
}
