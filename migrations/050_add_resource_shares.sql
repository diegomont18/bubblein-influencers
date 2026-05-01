-- Polymorphic per-resource sharing across casting_lists, leads_scans, lg_profiles.
-- Distinct from campaign_shares (token-based, anon-read).

DO $$ BEGIN
  CREATE TYPE public.resource_type AS ENUM ('casting_list', 'leads_scan', 'lg_profile');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.share_role AS ENUM ('viewer', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.share_status AS ENUM ('pending', 'accepted', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.resource_shares (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type     public.resource_type NOT NULL,
  resource_id       uuid NOT NULL,
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email     text NOT NULL,
  invited_user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role              public.share_role NOT NULL DEFAULT 'viewer',
  status            public.share_status NOT NULL DEFAULT 'pending',
  invite_token      text UNIQUE,
  invite_expires_at timestamptz,
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_share_no_self CHECK (
    invited_user_id IS NULL OR invited_user_id <> owner_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_resource_share_active
  ON public.resource_shares (resource_type, resource_id, lower(invited_email))
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_resource_shares_resource
  ON public.resource_shares (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_shares_invited_user
  ON public.resource_shares (invited_user_id)
  WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_resource_shares_invited_email
  ON public.resource_shares (lower(invited_email))
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_resource_shares_token
  ON public.resource_shares (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resource_shares_owner
  ON public.resource_shares (owner_id);

CREATE OR REPLACE FUNCTION public.touch_resource_shares()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_resource_shares_touch ON public.resource_shares;
CREATE TRIGGER trg_resource_shares_touch
  BEFORE UPDATE ON public.resource_shares
  FOR EACH ROW EXECUTE FUNCTION public.touch_resource_shares();

ALTER TABLE public.resource_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full" ON public.resource_shares;
CREATE POLICY "owner_full" ON public.resource_shares
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "invitee_read_own" ON public.resource_shares;
CREATE POLICY "invitee_read_own" ON public.resource_shares
  FOR SELECT
  USING (auth.uid() = invited_user_id AND status = 'accepted');

DROP POLICY IF EXISTS "editor_can_invite" ON public.resource_shares;
CREATE POLICY "editor_can_invite" ON public.resource_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.resource_shares peer
      WHERE peer.resource_type = resource_shares.resource_type
        AND peer.resource_id   = resource_shares.resource_id
        AND peer.invited_user_id = auth.uid()
        AND peer.status = 'accepted'
        AND peer.role   = 'editor'
        AND peer.owner_id = resource_shares.owner_id
    )
  );
