import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, AppRole } from './auth.service';

export const roleGuard =
  (...roles: AppRole[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (!auth.isLoggedIn() || !user) {
      return router.createUrlTree(['/login']);
    }
    return roles.includes(user.role)
      ? true
      : router.createUrlTree([auth.landingPath()]);
  };

export const loginRedirectGuard: CanActivateFn = () => {
  // Always permit viewing the login page so users can authenticate, sign in, or change role
  return true;
};
