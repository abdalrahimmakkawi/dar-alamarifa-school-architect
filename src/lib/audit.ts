/**
 * Log every sensitive action to Supabase audit_log table.
 * This implementation calls a server-side proxy to use the service role key safely.
 */

export async function logAction(
  action: string,         // e.g., 'student_deleted'
  performedBy: string,    // user email
  targetId?: string,      // e.g., student ID
  oldValue?: any,         // before state
  newValue?: any          // after state
): Promise<void> {
  // Fire-and-forget — never block UI for audit logging
  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      performedBy,
      targetId,
      oldValue,
      newValue
    })
  }).catch(err => console.error('Failed to log audit action:', err));
}

export async function logSecurityEvent(
  eventType: string,
  userEmail: string | null,
  details: string
): Promise<void> {
  fetch('/api/security-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType,
      userEmail,
      details
    })
  }).catch(err => console.error('Failed to log security event:', err));
}
