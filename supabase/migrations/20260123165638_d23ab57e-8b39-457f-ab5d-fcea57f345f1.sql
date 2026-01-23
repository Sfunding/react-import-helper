-- Create table to track login attempts for rate limiting
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient querying by IP and time
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at DESC);

-- Enable RLS (restrict to service role only)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table

-- Auto-cleanup old attempts (keep only last 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.login_attempts 
  WHERE attempted_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Run cleanup on each insert
CREATE TRIGGER trigger_cleanup_login_attempts
AFTER INSERT ON public.login_attempts
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_login_attempts();