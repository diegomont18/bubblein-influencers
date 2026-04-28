-- Recriar FK de sol_reports -> lg_profiles com ON DELETE SET NULL
-- para garantir que deletar um lg_profiles nao cascade-deleta os sol_reports,
-- e que deletar um sol_reports NUNCA afete lg_profiles.
ALTER TABLE sol_reports
  DROP CONSTRAINT IF EXISTS sol_reports_profile_id_fkey;

ALTER TABLE sol_reports
  ADD CONSTRAINT sol_reports_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES lg_profiles(id)
  ON DELETE SET NULL;

-- Mesma protecao para sol_posts -> sol_reports
ALTER TABLE sol_posts
  DROP CONSTRAINT IF EXISTS sol_posts_report_id_fkey;

ALTER TABLE sol_posts
  ADD CONSTRAINT sol_posts_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES sol_reports(id)
  ON DELETE CASCADE;
