-- Create saved_calculations table
CREATE TABLE public.saved_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  merchant_name TEXT,
  merchant_business_type TEXT,
  merchant_monthly_revenue NUMERIC DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_balance NUMERIC DEFAULT 0,
  total_daily_payment NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own calculations" 
ON public.saved_calculations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calculations" 
ON public.saved_calculations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calculations" 
ON public.saved_calculations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calculations" 
ON public.saved_calculations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_calculations_updated_at
BEFORE UPDATE ON public.saved_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();