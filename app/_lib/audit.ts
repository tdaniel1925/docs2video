import { createAdminClient } from './supabase/admin'

export async function logAdminAction(adminId: string, action: string, targetUserId?: string, details?: Record<string, unknown>) {
  const admin = createAdminClient()
  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId ?? null,
    details: details ?? null,
  })
}
