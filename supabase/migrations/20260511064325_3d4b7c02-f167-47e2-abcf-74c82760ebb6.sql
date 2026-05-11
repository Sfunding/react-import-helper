CREATE TABLE public.deal_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES public.saved_calculations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Scenario',
  scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_scenarios_calc ON public.deal_scenarios(calculation_id);
CREATE INDEX idx_deal_scenarios_user ON public.deal_scenarios(user_id);

ALTER TABLE public.deal_scenarios ENABLE ROW LEVEL SECURITY;

-- Helper: does the current user have access to this calculation?
CREATE OR REPLACE FUNCTION public.can_access_calculation(_calc_id uuid, _require_edit boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saved_calculations sc
    WHERE sc.id = _calc_id
      AND (
        sc.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.deal_shares ds
          WHERE ds.calculation_id = sc.id
            AND ds.shared_with = auth.uid()
            AND (NOT _require_edit OR ds.access_level = 'edit')
        )
      )
  )
$$;

CREATE POLICY "View scenarios for accessible deals"
ON public.deal_scenarios FOR SELECT TO authenticated
USING (public.can_access_calculation(calculation_id, false));

CREATE POLICY "Insert scenarios for editable deals"
ON public.deal_scenarios FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_calculation(calculation_id, true)
);

CREATE POLICY "Update scenarios for editable deals"
ON public.deal_scenarios FOR UPDATE TO authenticated
USING (public.can_access_calculation(calculation_id, true));

CREATE POLICY "Delete scenarios for editable deals"
ON public.deal_scenarios FOR DELETE TO authenticated
USING (public.can_access_calculation(calculation_id, true));

CREATE TRIGGER trg_deal_scenarios_updated_at
BEFORE UPDATE ON public.deal_scenarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();