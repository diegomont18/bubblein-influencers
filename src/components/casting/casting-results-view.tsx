"use client";

import { useState, useMemo } from "react";
import { CastingResultsDark } from "./casting-results-dark";
import { CastingProfile } from "./casting-results";

export interface CastingResultsViewProps {
  profiles: CastingProfile[];
  campaigns: { id: string; name: string }[];
  filterCampaignId?: string | null;
  onFilterCampaignChange?: (id: string | null) => void;
  title?: string;
  readOnly?: boolean;
}

export function CastingResultsView({
  profiles,
  campaigns,
  filterCampaignId,
  onFilterCampaignChange,
  title = "Resultados da Busca",
  readOnly = false,
}: CastingResultsViewProps) {
  const [activeView, setActiveView] = useState<"campanhas" | "panorama">("campanhas");

  const panoramaStats = useMemo(() => {
    const total = profiles.length;
    if (total === 0) return null;

    const avgFollowers = Math.round(profiles.reduce((s, p) => s + p.followers, 0) / total);
    const likesArr = profiles.map(p => p.avg_likes_per_post ?? 0);
    const commentsArr = profiles.map(p => p.avg_comments_per_post ?? 0);
    const avgEngagement = Math.round((likesArr.reduce((a, b) => a + b, 0) + commentsArr.reduce((a, b) => a + b, 0)) / total);
    const scoresArr = profiles.map(p => p.final_score ?? p.creator_score ?? 0);
    const avgScore = Math.round(scoresArr.reduce((a, b) => a + b, 0) / total);

    const followerBuckets = [
      { label: "< 5K", min: 0, max: 5000, count: 0 },
      { label: "5K – 10K", min: 5000, max: 10000, count: 0 },
      { label: "10K – 25K", min: 10000, max: 25000, count: 0 },
      { label: "25K – 50K", min: 25000, max: 50000, count: 0 },
      { label: "50K+", min: 50000, max: Infinity, count: 0 },
    ];
    profiles.forEach(p => {
      const b = followerBuckets.find(b => p.followers >= b.min && p.followers < b.max);
      if (b) b.count++;
    });
    const maxFollowerBucket = Math.max(...followerBuckets.map(b => b.count), 1);

    const avgLikes = Math.round(likesArr.reduce((a, b) => a + b, 0) / total);
    const avgComments = Math.round(commentsArr.reduce((a, b) => a + b, 0) / total);
    const medLikesArr = profiles.map(p => p.median_likes_per_post ?? 0);
    const medCommentsArr = profiles.map(p => p.median_comments_per_post ?? 0);
    const medianLikes = Math.round(medLikesArr.reduce((a, b) => a + b, 0) / total);
    const medianComments = Math.round(medCommentsArr.reduce((a, b) => a + b, 0) / total);

    const topicCounts: Record<string, number> = {};
    profiles.forEach(p => (p.topics ?? []).forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; }));
    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxTopicCount = Math.max(...topTopics.map(t => t[1]), 1);

    const scoreHigh = profiles.filter(p => (p.final_score ?? p.creator_score ?? 0) >= 70).length;
    const scoreMed = profiles.filter(p => { const s = p.final_score ?? p.creator_score ?? 0; return s >= 40 && s < 70; }).length;
    const scoreLow = profiles.filter(p => (p.final_score ?? p.creator_score ?? 0) < 40).length;

    const kwCounts: Record<string, number> = {};
    profiles.forEach(p => { if (p.source_keyword) kwCounts[p.source_keyword] = (kwCounts[p.source_keyword] || 0) + 1; });
    const topKeywords = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]);
    const maxKwCount = Math.max(...topKeywords.map(k => k[1]), 1);

    return {
      total, avgFollowers, avgEngagement, avgScore,
      followerBuckets, maxFollowerBucket,
      avgLikes, avgComments, medianLikes, medianComments,
      topTopics, maxTopicCount,
      scoreHigh, scoreMed, scoreLow,
      topKeywords, maxKwCount,
    };
  }, [profiles]);

  const showCampaignFilter = !!onFilterCampaignChange && (campaigns.length > 1 || !!filterCampaignId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-lexend)]">
            {title}
            <span className="ml-2 text-sm font-normal text-[#adaaaa]">{profiles.length} resultados</span>
          </h2>
          {/* View toggle */}
          <div className="flex rounded-full bg-[#20201f] p-0.5">
            <button
              onClick={() => setActiveView("campanhas")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${activeView === "campanhas" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Campanhas
            </button>
            <button
              onClick={() => setActiveView("panorama")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all font-[family-name:var(--font-lexend)] ${activeView === "panorama" ? "bg-[#ca98ff] text-[#46007d]" : "text-[#adaaaa] hover:text-white"}`}
            >
              Panorama
            </button>
          </div>
        </div>

        {/* Campaign filter */}
        {showCampaignFilter && (
          <select
            value={filterCampaignId ?? ""}
            onChange={(e) => onFilterCampaignChange?.(e.target.value || null)}
            className="rounded-full bg-[#20201f] px-4 py-2 text-xs text-[#adaaaa] outline-none font-[family-name:var(--font-lexend)] border-b-2 border-transparent focus:border-[#ca98ff]"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Campanhas view */}
      {activeView === "campanhas" && (
        <>
          {profiles.length === 0 ? (
            <div className="rounded-2xl bg-[#131313] overflow-hidden">
              <div className="px-6 py-12 text-center text-[#adaaaa] text-sm">
                Nenhum creator encontrado{filterCampaignId ? " para essa campanha" : ""}. Faça uma busca para ver os resultados.
              </div>
            </div>
          ) : (
            <CastingResultsDark
              profiles={profiles}
              readOnly={readOnly}
            />
          )}
        </>
      )}

      {/* Panorama view */}
      {activeView === "panorama" && (
        panoramaStats ? (
          <div className="space-y-4">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Total de Creators</div>
                <div className="text-2xl font-bold text-white mt-1">{panoramaStats.total}</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Média de Seguidores</div>
                <div className="text-2xl font-bold text-[#ca98ff] mt-1">{panoramaStats.avgFollowers.toLocaleString("pt-BR")}</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Média de Engajamento</div>
                <div className="text-2xl font-bold text-[#a2f31f] mt-1">{panoramaStats.avgEngagement.toLocaleString("pt-BR")}</div>
                <div className="text-[10px] text-[#adaaaa] mt-0.5">likes + comentários / post</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Creator Score Médio</div>
                <div className="text-2xl font-bold text-white mt-1">{panoramaStats.avgScore}<span className="text-sm font-normal text-[#adaaaa] ml-1">/ 100</span></div>
              </div>
            </div>

            {/* Follower Distribution */}
            <div className="rounded-2xl bg-[#131313] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262626]">
                <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Distribuição de Seguidores</h3>
              </div>
              <div className="px-4 py-3 space-y-2">
                {panoramaStats.followerBuckets.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#adaaaa] w-20 text-right font-[family-name:var(--font-lexend)]">{b.label}</span>
                    <div className="flex-1 h-5 bg-[#20201f] rounded-full overflow-hidden">
                      <div className="h-full bg-[#ca98ff] rounded-full transition-all" style={{ width: `${(b.count / panoramaStats.maxFollowerBucket) * 100}%` }} />
                    </div>
                    <span className="text-xs text-white w-8 font-[family-name:var(--font-lexend)]">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Média de Likes</div>
                <div className="text-xl font-bold text-white mt-1">{panoramaStats.avgLikes.toLocaleString("pt-BR")}</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Média de Comentários</div>
                <div className="text-xl font-bold text-white mt-1">{panoramaStats.avgComments.toLocaleString("pt-BR")}</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Mediana de Likes</div>
                <div className="text-xl font-bold text-white mt-1">{panoramaStats.medianLikes.toLocaleString("pt-BR")}</div>
              </div>
              <div className="rounded-xl bg-[#131313] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Mediana de Comentários</div>
                <div className="text-xl font-bold text-white mt-1">{panoramaStats.medianComments.toLocaleString("pt-BR")}</div>
              </div>
            </div>

            {/* Topic Distribution */}
            {panoramaStats.topTopics.length > 0 && (
              <div className="rounded-2xl bg-[#131313] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Tópicos Mais Frequentes</h3>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {panoramaStats.topTopics.map(([topic, count]) => (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="text-xs text-[#adaaaa] w-32 truncate text-right font-[family-name:var(--font-lexend)]" title={topic}>{topic}</span>
                      <div className="flex-1 h-5 bg-[#20201f] rounded-full overflow-hidden">
                        <div className="h-full bg-[#a2f31f] rounded-full transition-all" style={{ width: `${(count / panoramaStats.maxTopicCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-white w-8 font-[family-name:var(--font-lexend)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Creator Score Distribution */}
            <div className="rounded-2xl bg-[#131313] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262626]">
                <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Distribuição de Creator Score</h3>
              </div>
              <div className="px-4 py-3 space-y-2">
                {[
                  { label: "Alto (≥ 70)", count: panoramaStats.scoreHigh, color: "bg-[#a2f31f]" },
                  { label: "Médio (40–69)", count: panoramaStats.scoreMed, color: "bg-[#ca98ff]" },
                  { label: "Baixo (< 40)", count: panoramaStats.scoreLow, color: "bg-[#ff946e]" },
                ].map((tier) => (
                  <div key={tier.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#adaaaa] w-28 text-right font-[family-name:var(--font-lexend)]">{tier.label}</span>
                    <div className="flex-1 h-5 bg-[#20201f] rounded-full overflow-hidden">
                      <div className={`h-full ${tier.color} rounded-full transition-all`} style={{ width: `${panoramaStats.total > 0 ? (tier.count / panoramaStats.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-white w-8 font-[family-name:var(--font-lexend)]">{tier.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Source Keywords */}
            {panoramaStats.topKeywords.length > 0 && (
              <div className="rounded-2xl bg-[#131313] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h3 className="text-sm font-semibold text-white font-[family-name:var(--font-lexend)]">Creators por Keyword</h3>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {panoramaStats.topKeywords.map(([kw, count]) => (
                    <div key={kw} className="flex items-center gap-3">
                      <span className="text-xs text-[#adaaaa] w-32 truncate text-right font-[family-name:var(--font-lexend)]" title={kw}>{kw}</span>
                      <div className="flex-1 h-5 bg-[#20201f] rounded-full overflow-hidden">
                        <div className="h-full bg-[#ca98ff] rounded-full transition-all" style={{ width: `${(count / panoramaStats.maxKwCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-white w-8 font-[family-name:var(--font-lexend)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#131313] overflow-hidden">
            <div className="px-6 py-12 text-center text-[#adaaaa] text-sm">
              Nenhum creator encontrado{filterCampaignId ? " para essa campanha" : ""}. Faça uma busca para ver o panorama.
            </div>
          </div>
        )
      )}
    </div>
  );
}
