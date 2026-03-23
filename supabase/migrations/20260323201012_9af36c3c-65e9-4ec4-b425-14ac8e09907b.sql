
-- Create deal_shares table
CREATE TABLE public.deal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES public.saved_calculations(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL,
  access_level text NOT NULL DEFAULT 'view',
  shared_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calculation_id, shared_with)
);

ALTER TABLE public.deal_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their shares" ON public.deal_shares
FOR SELECT TO authenticated
USING (shared_with = auth.uid() OR shared_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and managers can share" ON public.deal_shares
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Can revoke shares" ON public.deal_shares
FOR DELETE TO authenticated
USING (shared_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create user_permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_export boolean NOT NULL DEFAULT true,
  can_delete_deals boolean NOT NULL DEFAULT true,
  can_view_others boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own permissions" ON public.user_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert permissions" ON public.user_permissions
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update permissions" ON public.user_permissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete permissions" ON public.user_permissions
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update saved_calculations SELECT policy to include shared deals
DROP POLICY IF EXISTS "Users see own deals, admin sees all" ON public.saved_calculations;
CREATE POLICY "Users see own, shared, admin sees all"
ON public.saved_calculations FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.deal_shares
    WHERE deal_shares.calculation_id = saved_calculations.id
    AND deal_shares.shared_with = auth.uid()
  )
);

-- Update saved_calculations UPDATE policy to include edit-shared deals
DROP POLICY IF EXISTS "Users update own deals, admin updates all" ON public.saved_calculations;
CREATE POLICY "Users update own, edit-shared, admin updates all"
ON public.saved_calculations FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.deal_shares
    WHERE deal_shares.calculation_id = saved_calculations.id
    AND deal_shares.shared_with = auth.uid()
    AND deal_shares.access_level = 'edit'
  )
);
