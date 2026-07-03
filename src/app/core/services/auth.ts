import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AppConfigService } from './app-config.service';

interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  username: string;
  email: string;
  role: string;
  licenseWarning?: string | null;
  tenantName?: string | null;
  organizationId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly cfg  = inject(AppConfigService);

  private get apiUrl(): string { return `${this.cfg.crmApiUrl}/api/v1/auth`; }
  private readonly accessTokenKey = 'accessToken';
  private readonly refreshTokenKey = 'refreshToken';
  private readonly userKey = 'crmUser';

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(r => this.storeSession(r))
    );
  }

  private storeSession(r: AuthResponse): void {
    // Wipe stale license state so the guard re-fetches fresh policy on next nav
    localStorage.removeItem('licenseStatus');
    localStorage.removeItem('accesspolicy');

    localStorage.setItem(this.accessTokenKey, r.accessToken);
    localStorage.setItem(this.refreshTokenKey, r.refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify({
      name: r.username,
      email: r.email,
      role: r.role,
      licenseWarning: r.licenseWarning ?? null,
      tenantName: r.tenantName ?? null,
      organizationId: r.organizationId ?? null
    }));
  }

  getLicenseWarning(): string | null {
    const stored = localStorage.getItem(this.userKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored).licenseWarning ?? null;
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getOrganizationId(): string | null {
    const stored = localStorage.getItem(this.userKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored).organizationId ?? null;
    } catch {
      return null;
    }
  }

  getTenantName(): string | null {
    const stored = localStorage.getItem(this.userKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored).tenantName ?? null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('accesspolicy');
    localStorage.removeItem('licenseStatus');
  }
}
