-- Daily activity reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  report_type text NOT NULL DEFAULT 'daily',
  data jsonb NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_daily_reports_period ON daily_reports (period_start DESC);
CREATE INDEX idx_daily_reports_type ON daily_reports (report_type);
