ALTER TABLE profiles ADD COLUMN tags text[] DEFAULT '{}';
CREATE INDEX profiles_tags_idx ON profiles USING GIN (tags);
