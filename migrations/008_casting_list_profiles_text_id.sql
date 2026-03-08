-- Change profile_id from uuid to text since casting uses LinkedIn slugs, not profiles table UUIDs
ALTER TABLE casting_list_profiles DROP CONSTRAINT IF EXISTS casting_list_profiles_profile_id_fkey;
ALTER TABLE casting_list_profiles ALTER COLUMN profile_id TYPE text USING profile_id::text;
