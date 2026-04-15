-- Track current Apify billing-cycle usage and alert state.
-- Singleton row (id = 1) updated by the apify-usage-check scheduled function.
CREATE TABLE IF NOT EXISTS apify_usage_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_usage_usd numeric NOT NULL DEFAULT 0,
  max_monthly_usage_usd numeric NOT NULL DEFAULT 0,
  billing_cycle_start timestamptz,
  billing_cycle_end timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now(),
  alert_70_sent_at timestamptz,
  alert_85_sent_at timestamptz,
  alert_95_sent_at timestamptz
);

INSERT INTO apify_usage_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
