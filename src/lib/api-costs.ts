import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Estimated costs per API call (USD)
export const API_COSTS = {
  scrapingdog: {
    fetchLinkedInProfile: 0.004,
    searchGoogle: 0.002,
    fetchLinkedInPost: 0.003,
  },
  apify: {
    searchLinkedInProfiles: 0.05,
    fetchProfilePosts: 0.02,
    fetchProfilePostsBatch: 0.02, // per profile in batch
    searchLinkedInPosts: 0.05,
    fetchPostEngagers: 0.03,
  },
  openrouter: {
    classifyTopics: 0.001,
    checkRelevance: 0.001,
    generateSearchSynonyms: 0.0003,
    generateTitleSynonyms: 0.0003,
    checkPublishLanguage: 0.001,
    generateEmbedding: 0.0001,
    batchScoreIcpMatch: 0.0002,
  },
} as const;

export type Provider = keyof typeof API_COSTS;
export type Source = "casting" | "leads" | "enrichment";

interface LogParams {
  userId?: string;
  source: Source;
  searchId?: string;
  provider: Provider;
  operation: string;
  estimatedCost: number;
  creditsUsed?: number;
  metadata?: Record<string, unknown>;
}

export function logApiCost(params: LogParams): void {
  // Fire-and-forget: don't block the calling code
  const client = createClient(supabaseUrl, supabaseServiceKey);
  client
    .from("api_costs")
    .insert({
      user_id: params.userId || null,
      source: params.source,
      search_id: params.searchId || null,
      provider: params.provider,
      operation: params.operation,
      estimated_cost: params.estimatedCost,
      credits_used: params.creditsUsed || 0,
      metadata: params.metadata || null,
    })
    .then(({ error }) => {
      if (error) console.error("[api-costs] Failed to log:", error.message);
    });
}
