-- Add edited_fields column to track manually edited fields
ALTER TABLE profiles
  ADD COLUMN edited_fields text[] NOT NULL DEFAULT '{}';
