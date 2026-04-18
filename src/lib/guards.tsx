import React, { useEffect } from 'react';
import { User } from '../types';
import { logSecurityEvent } from './audit';

interface AdminGuardProps {
  user: User | null;
  children: React.ReactNode;
}

/**
 * Route guard — wraps any component that requires admin role.
 * If not admin: redirect to staff interface immediately, log the attempt.
 */
export function AdminGuard({ user, children }: AdminGuardProps) {
  useEffect(() => {
    if (user && user.role !== 'admin') {
      logSecurityEvent(
        'unauthorized_access',
        user.email,
        `Unauthorized attempt to access admin route: ${window.location.pathname}`
      );
      window.location.href = '/staff';
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return null; // Never show an error message that reveals what the protected route contains
  }

  return <>{children}</>;
}
