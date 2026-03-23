import { supabase } from '@/integrations/supabase/client';

export function logAuditEvent(params: {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  // Fire-and-forget: don't await, don't block the caller
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user) return;
    supabase
      .from('audit_logs')
      .insert({
        user_id: session.user.id,
        action: params.action,
        resource_type: params.resourceType || null,
        resource_id: params.resourceId || null,
        metadata: params.metadata || {},
      })
      .then(({ error }) => {
        if (error) console.error('Audit log error:', error);
      });
  });
}
