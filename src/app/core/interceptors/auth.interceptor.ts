import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (req.url.includes('/api/v1/auth/login')) {
    return next(req);
  }

  const token = authService.getAccessToken();
  const orgId = authService.getOrganizationId();
  let nextReq = req;

  if (token) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (orgId) {
      headers['X-Organization-Id'] = orgId;
    }
    nextReq = req.clone({ setHeaders: headers });
  }

  return next(nextReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};