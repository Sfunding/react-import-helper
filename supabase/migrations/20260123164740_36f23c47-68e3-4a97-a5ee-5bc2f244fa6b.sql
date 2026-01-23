-- Remove public read access to app_config (password will only be verified via edge function with service role)
DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;

-- Update the existing password to a bcrypt hash of 'demo123'
-- Hash generated with bcrypt cost factor 10
UPDATE public.app_config 
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.EsG5xaHmVyDMCoE.9G'
WHERE id = 'main';