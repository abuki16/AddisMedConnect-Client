import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, AppRole } from './auth.service';

export const roleGuard =
  (...roles: AppRole[]): CanActivateFn =>
  (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (!auth.isLoggedIn() || !user) {
      return router.createUrlTree(['/login']);
    }

    const userRole = (user.role || '').trim().toLowerCase();
    const hasRole = roles.some((r) => {
      const target = r.toLowerCase();
      return (
        target === userRole ||
        (target === 'dispatcher' && userRole.includes('dispatch')) ||
        (target === 'ambulancedriver' && userRole.includes('driver')) ||
        (target === 'triagenurse' && userRole.includes('triage')) ||
        (target === 'dischargeclerk' && userRole.includes('discharge')) ||
        (target === 'systemadmin' && (userRole.includes('admin') || userRole === 'admin'))
      );
    });

    if (hasRole) {
      return true;
    }

    const targetLanding = auth.landingPath();
    if (state.url === targetLanding) {
      return router.createUrlTree(['/login']);
    }
    return router.createUrlTree([targetLanding]);
  };

export const loginRedirectGuard: CanActivateFn = () => {
  // Always permit viewing the login page so users can authenticate, sign in, or change role
  return true;
};
