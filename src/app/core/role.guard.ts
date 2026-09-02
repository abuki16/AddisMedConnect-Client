import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, AppRole } from './auth.service';
export const roleGuard =
  (...roles: AppRole[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    return user && roles.includes(user.role)
      ? true
      : router.createUrlTree([user ? auth.landingPath() : '/login']);
  };

export const loginRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree([auth.landingPath()]) : true;
};
