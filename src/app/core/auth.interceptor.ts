import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = sessionStorage.getItem('amc_access_token') || localStorage.getItem('amc_access_token');

  // Attach token if token exists and it's either a relative API request or targets our backend
  const isApiRequest = req.url.startsWith('/api') || req.url.startsWith('http://localhost:5057');

  if (token && isApiRequest) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};