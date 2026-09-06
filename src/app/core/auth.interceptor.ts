import { HttpInterceptorFn } from '@angular/common/http';
import { apiUrl } from './api.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token =
    sessionStorage.getItem('amc_access_token') ||
    localStorage.getItem('amc_access_token');

  // Attach token if token exists and request matches relative api or configured apiUrl
  const isApiRequest =
    req.url.startsWith('/api') ||
    (!!apiUrl && req.url.startsWith(apiUrl));

  if (token && isApiRequest) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};