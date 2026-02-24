DROP POLICY "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);