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

/**
 * Record a security-relevant event a USER did to their OWN account — the kind
 * SOC 2 requires a trail for: account deletion, data export, connecting an inbox,
 * etc. Reuses the same admin_audit_log table (the actor goes in admin_id, and is
 * their own target). Best-effort: never let a logging failure break the action.
 */
export async function logSecurityEvent(actorUserId: string, action: string, details?: Record<string, unknown>) {
  try {
    const admin = createAdminClient()
    await admin.from('admin_audit_log').insert({
      admin_id: actorUserId,
      action,
      target_user_id: actorUserId,
      details: details ?? null,
    })
  } catch (e) {
    console.error('[audit] logSecurityEvent failed:', e instanceof Error ? e.message : e)
  }
}
