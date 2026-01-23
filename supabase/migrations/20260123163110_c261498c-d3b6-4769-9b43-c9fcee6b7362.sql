-- Create app_config table to store shared password
CREATE TABLE public.app_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for password verification via edge function)
-- No direct write access - only through edge function
CREATE POLICY "Anyone can read app_config" 
ON public.app_config 
FOR SELECT 
USING (true);

-- Insert default password (will be hashed as "demo123" - user should change immediately)
INSERT INTO public.app_config (id, password_hash) 
VALUES ('main', 'demo123');

-- Add trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();