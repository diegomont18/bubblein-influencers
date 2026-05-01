ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS sales_contact_interest boolean DEFAULT true;

COMMENT ON COLUMN public.user_roles.phone IS 'BR mobile number, digits only (10 or 11 chars)';
COMMENT ON COLUMN public.user_roles.sales_contact_interest IS 'User opted in to be contacted by sales team';
