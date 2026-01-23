-- Fix failed saves: remove invalid FK on saved_calculations.user_id and add a safe default shared id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_calculations_user_id_fkey'
  ) THEN
    ALTER TABLE public.saved_calculations
      DROP CONSTRAINT saved_calculations_user_id_fkey;
  END IF;
END $$;

ALTER TABLE public.saved_calculations
  ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Ensure existing rows (if any) have a user_id
UPDATE public.saved_calculations
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id IS NULL;