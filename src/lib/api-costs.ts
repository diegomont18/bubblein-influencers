import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Estimated costs per API call (USD)
export const API_COSTS = {
  apify: {
    searchLinkedInProfiles: 0.05,
    fetchProfilePosts: 0.02,
    fetchProfilePostsBatch: 0.02, // per profile in batch
    searchLinkedInPosts: 0.05,
    // fetchPostEngagers is NOT a fixed cost — harvestapi charges per
    // reaction/comment extracted. The real cost is computed dynamically
    // inside fetchPostEngagers() based on items returned. This constant
    // is kept only as a fallback / actor-start floor.
    fetchPostEngagers: 0.0001,
    // harvestapi per-item price for reactions/comments (confirmed from
    // Apify billing report). Used for dynamic cost calc.
    perEngagerItem: 0.002,
    // supreme_coder/linkedin-post per-item price — ~40% cheaper.
    perSupremeItem: 0.0012,
    fetchLinkedInProfileApify: 0.004,
    searchGoogleApify: 0.0035,
    fetchLinkedInCompany: 0.005,
    fetchCompanyEmployees: 0.004, // per employee
  },
  serper: {
    searchGoogle: 0.001,
  },
  scrapingdog: {
    searchGoogle: 0.001,
  },
  openrouter: {
    classifyTopics: 0.001,
    checkRelevance: 0.001,
    generateSearchSynonyms: 0.0003,
    generateTitleSynonyms: 0.0003,
    checkPublishLanguage: 0.001,
    generateEmbedding: 0.0001,
    batchScoreIcpMatch: 0.0002,
    classifyPost: 0.001,
    classifySentiment: 0.0005,
    generateSolRecommendations: 0.01,
    generateSolSuggestedPosts: 0.01,
    extractBrands: 0.001,
  },
} as const;

export type Provider = keyof typeof API_COSTS;
export type Source = "casting" | "leads" | "enrichment" | "sol";

export interface CostCtx {
  userId?: string;
  source?: Source;
  searchId?: string;
}

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
