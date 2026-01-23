-- Drop existing RLS policies that require auth
DROP POLICY IF EXISTS "Users can create their own calculations" ON public.saved_calculations;
DROP POLICY IF EXISTS "Users can view their own calculations" ON public.saved_calculations;
DROP POLICY IF EXISTS "Users can update their own calculations" ON public.saved_calculations;
DROP POLICY IF EXISTS "Users can delete their own calculations" ON public.saved_calculations;

-- Create new open policies for shared access (protected by app-level password)
CREATE POLICY "Allow all select on saved_calculations" 
ON public.saved_calculations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all insert on saved_calculations" 
ON public.saved_calculations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all update on saved_calculations" 
ON public.saved_calculations 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow all delete on saved_calculations" 
ON public.saved_calculations 
FOR DELETE 
USING (true);