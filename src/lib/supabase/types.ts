export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          url: string;
          linkedin_id: string | null;
          name: string | null;
          headline: string | null;
          company_current: string | null;
          role_current: string | null;
          current_job: string | null;
          location: string | null;
          followers_count: number | null;
          connections_count: number | null;
          about: string | null;
          topics: string[] | null;
          tags: string[];
          edited_fields: string[];
          checked: boolean;
          topics_embedding: string | null;
          posting_frequency: string | null;
          posting_frequency_score: number | null;
          enrichment_status: string;
          raw_data: Json | null;
          last_enriched_at: string | null;
          avg_likes_per_post: number | null;
          avg_comments_per_post: number | null;
          creator_score: number | null;
          casting_keywords: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          linkedin_id?: string | null;
          name?: string | null;
          headline?: string | null;
          company_current?: string | null;
          role_current?: string | null;
          current_job?: string | null;
          location?: string | null;
          followers_count?: number | null;
          connections_count?: number | null;
          about?: string | null;
          topics?: string[] | null;
          tags?: string[];
          edited_fields?: string[];
          checked?: boolean;
          topics_embedding?: string | null;
          posting_frequency?: string | null;
          posting_frequency_score?: number | null;
          enrichment_status?: string;
          raw_data?: Json | null;
          last_enriched_at?: string | null;
          avg_likes_per_post?: number | null;
          avg_comments_per_post?: number | null;
          creator_score?: number | null;
          casting_keywords?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          linkedin_id?: string | null;
          name?: string | null;
          headline?: string | null;
          company_current?: string | null;
          role_current?: string | null;
          current_job?: string | null;
          location?: string | null;
          followers_count?: number | null;
          connections_count?: number | null;
          about?: string | null;
          topics?: string[] | null;
          tags?: string[];
          edited_fields?: string[];
          checked?: boolean;
          topics_embedding?: string | null;
          posting_frequency?: string | null;
          posting_frequency_score?: number | null;
          enrichment_status?: string;
          raw_data?: Json | null;
          last_enriched_at?: string | null;
          avg_likes_per_post?: number | null;
          avg_comments_per_post?: number | null;
          creator_score?: number | null;
          casting_keywords?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_experiences: {
        Row: {
          id: string;
          profile_id: string;
          company: string | null;
          role: string | null;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company?: string | null;
          role?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_current?: boolean | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company?: string | null;
          role?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_current?: boolean | null;
          description?: string | null;
          created_at?: string;
        };
      };
      enrichment_jobs: {
        Row: {
          id: string;
          profile_id: string;
          status: string;
          attempt_count: number;
          last_error: string | null;
          scrapingdog_status: number | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          status?: string;
          attempt_count?: number;
          last_error?: string | null;
          scrapingdog_status?: number | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          status?: string;
          attempt_count?: number;
          last_error?: string | null;
          scrapingdog_status?: number | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      casting_lists: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          query_theme: string;
          query_embedding: string | null;
          filters_applied: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          query_theme: string;
          query_embedding?: string | null;
          filters_applied?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          query_theme?: string;
          query_embedding?: string | null;
          filters_applied?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      casting_list_profiles: {
        Row: {
          id: string;
          list_id: string;
          profile_id: string;
          relevance_score: number | null;
          frequency_score: number | null;
          composite_score: number | null;
          rank_position: number | null;
          notes: string | null;
          status: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          profile_id: string;
          relevance_score?: number | null;
          frequency_score?: number | null;
          composite_score?: number | null;
          rank_position?: number | null;
          notes?: string | null;
          status?: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          profile_id?: string;
          relevance_score?: number | null;
          frequency_score?: number | null;
          composite_score?: number | null;
          rank_position?: number | null;
          notes?: string | null;
          status?: string;
          added_at?: string;
        };
      };
      monitoring_configs: {
        Row: {
          id: string;
          profile_id: string;
          is_active: boolean;
          watch_topics: string[];
          alert_threshold: number;
          check_frequency: string;
          next_check_at: string;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          is_active?: boolean;
          watch_topics: string[];
          alert_threshold?: number;
          check_frequency?: string;
          next_check_at?: string;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          is_active?: boolean;
          watch_topics?: string[];
          alert_threshold?: number;
          check_frequency?: string;
          next_check_at?: string;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          profile_id: string;
          post_url: string;
          text: string | null;
          reactions_count: number | null;
          comments_count: number | null;
          published_at: string | null;
          topics_detected: string[] | null;
          sentiment: string | null;
          sentiment_score: number | null;
          ai_relevance_score: number | null;
          keywords: string[] | null;
          post_embedding: string | null;
          raw_data: Json | null;
          scraped_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          post_url: string;
          text?: string | null;
          reactions_count?: number | null;
          comments_count?: number | null;
          published_at?: string | null;
          topics_detected?: string[] | null;
          sentiment?: string | null;
          sentiment_score?: number | null;
          ai_relevance_score?: number | null;
          keywords?: string[] | null;
          post_embedding?: string | null;
          raw_data?: Json | null;
          scraped_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          post_url?: string;
          text?: string | null;
          reactions_count?: number | null;
          comments_count?: number | null;
          published_at?: string | null;
          topics_detected?: string[] | null;
          sentiment?: string | null;
          sentiment_score?: number | null;
          ai_relevance_score?: number | null;
          keywords?: string[] | null;
          post_embedding?: string | null;
          raw_data?: Json | null;
          scraped_at?: string;
        };
      };
      monitoring_alerts: {
        Row: {
          id: string;
          monitoring_config_id: string;
          profile_id: string;
          post_id: string;
          matched_topic: string;
          match_score: number;
          alert_sent_at: string | null;
          alert_channel: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitoring_config_id: string;
          profile_id: string;
          post_id: string;
          matched_topic: string;
          match_score: number;
          alert_sent_at?: string | null;
          alert_channel?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitoring_config_id?: string;
          profile_id?: string;
          post_id?: string;
          matched_topic?: string;
          match_score?: number;
          alert_sent_at?: string | null;
          alert_channel?: string | null;
          created_at?: string;
        };
      };
      checker_entries: {
        Row: {
          id: string;
          name: string;
          headline: string;
          original_url: string;
          verified_url: string | null;
          status: string;
          search_results: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          headline?: string;
          original_url: string;
          verified_url?: string | null;
          status?: string;
          search_results?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          headline?: string;
          original_url?: string;
          verified_url?: string | null;
          status?: string;
          search_results?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scraping_jobs: {
        Row: {
          id: string;
          monitoring_config_id: string;
          profile_id: string;
          job_type: string;
          status: string;
          posts_found: number | null;
          posts_new: number | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          monitoring_config_id: string;
          profile_id: string;
          job_type: string;
          status?: string;
          posts_found?: number | null;
          posts_new?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          monitoring_config_id?: string;
          profile_id?: string;
          job_type?: string;
          status?: string;
          posts_found?: number | null;
          posts_new?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
    };
    Functions: {
      match_profiles_by_embedding: {
        Args: {
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          profile_id: string;
          similarity: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
