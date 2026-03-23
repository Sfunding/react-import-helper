import { supabase } from '@/integrations/supabase/client';

function insertAuditLog(userId: string, params: { action: string; resourceType?: string; resourceId?: string; metadata?: Record<string, any> }) {
  supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: params.action,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      metadata: params.metadata || {},
    })
    .then(({ error }) => {
      if (error) console.error('Audit log error:', error);
    });
}

export function logAuditEvent(params: {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  userId?: string;
}) {
  if (params.userId) {
    insertAuditLog(params.userId, params);
  } else {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      insertAuditLog(session.user.id, params);
    });
  }
}
