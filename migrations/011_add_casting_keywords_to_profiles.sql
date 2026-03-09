-- Add casting_keywords column to profiles table
-- Stores comma-separated keyword themes from casting search
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS casting_keywords text;
