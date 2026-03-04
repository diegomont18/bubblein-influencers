-- Migration: Add RLS policies for authenticated access
-- All 9 tables get full CRUD for authenticated users

-- profiles
create policy "Authenticated users can read profiles"
  on profiles for select to authenticated using (true);
create policy "Authenticated users can insert profiles"
  on profiles for insert to authenticated with check (true);
create policy "Authenticated users can update profiles"
  on profiles for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete profiles"
  on profiles for delete to authenticated using (true);

-- profile_experiences
create policy "Authenticated users can read profile_experiences"
  on profile_experiences for select to authenticated using (true);
create policy "Authenticated users can insert profile_experiences"
  on profile_experiences for insert to authenticated with check (true);
create policy "Authenticated users can update profile_experiences"
  on profile_experiences for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete profile_experiences"
  on profile_experiences for delete to authenticated using (true);

-- enrichment_jobs
create policy "Authenticated users can read enrichment_jobs"
  on enrichment_jobs for select to authenticated using (true);
create policy "Authenticated users can insert enrichment_jobs"
  on enrichment_jobs for insert to authenticated with check (true);
create policy "Authenticated users can update enrichment_jobs"
  on enrichment_jobs for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete enrichment_jobs"
  on enrichment_jobs for delete to authenticated using (true);

-- casting_lists
create policy "Authenticated users can read casting_lists"
  on casting_lists for select to authenticated using (true);
create policy "Authenticated users can insert casting_lists"
  on casting_lists for insert to authenticated with check (true);
create policy "Authenticated users can update casting_lists"
  on casting_lists for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete casting_lists"
  on casting_lists for delete to authenticated using (true);

-- casting_list_profiles
create policy "Authenticated users can read casting_list_profiles"
  on casting_list_profiles for select to authenticated using (true);
create policy "Authenticated users can insert casting_list_profiles"
  on casting_list_profiles for insert to authenticated with check (true);
create policy "Authenticated users can update casting_list_profiles"
  on casting_list_profiles for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete casting_list_profiles"
  on casting_list_profiles for delete to authenticated using (true);

-- monitoring_configs
create policy "Authenticated users can read monitoring_configs"
  on monitoring_configs for select to authenticated using (true);
create policy "Authenticated users can insert monitoring_configs"
  on monitoring_configs for insert to authenticated with check (true);
create policy "Authenticated users can update monitoring_configs"
  on monitoring_configs for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete monitoring_configs"
  on monitoring_configs for delete to authenticated using (true);

-- posts
create policy "Authenticated users can read posts"
  on posts for select to authenticated using (true);
create policy "Authenticated users can insert posts"
  on posts for insert to authenticated with check (true);
create policy "Authenticated users can update posts"
  on posts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete posts"
  on posts for delete to authenticated using (true);

-- monitoring_alerts
create policy "Authenticated users can read monitoring_alerts"
  on monitoring_alerts for select to authenticated using (true);
create policy "Authenticated users can insert monitoring_alerts"
  on monitoring_alerts for insert to authenticated with check (true);
create policy "Authenticated users can update monitoring_alerts"
  on monitoring_alerts for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete monitoring_alerts"
  on monitoring_alerts for delete to authenticated using (true);

-- scraping_jobs
create policy "Authenticated users can read scraping_jobs"
  on scraping_jobs for select to authenticated using (true);
create policy "Authenticated users can insert scraping_jobs"
  on scraping_jobs for insert to authenticated with check (true);
create policy "Authenticated users can update scraping_jobs"
  on scraping_jobs for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete scraping_jobs"
  on scraping_jobs for delete to authenticated using (true);
