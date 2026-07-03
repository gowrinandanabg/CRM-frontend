import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth';

export interface DashboardSummaryResponse {
  totalContacts: number;
  totalLeads: number;
  hotLeads: number;
  tasksDueToday: number;
  revenueGenerated: number;
  pipelineValue: number;
  totalCampaigns: number;
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
}

export interface SalesUserOption {
  username: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(AppConfigService);
  private readonly auth = inject(AuthService);

  private get base(): string {
    return `${this.cfg.crmApiUrl}/api/v1/reports`;
  }

  getDashboardSummary(username?: string | null): Observable<DashboardSummaryResponse> {
    const orgId = this.auth.getOrganizationId();
    const params = new URLSearchParams();
    if (username) params.set('username', username);
    if (orgId) params.set('organizationId', orgId);
    const qs = params.toString();
    return this.http.get<DashboardSummaryResponse>(`${this.base}/dashboard${qs ? '?' + qs : ''}`);
  }

  getSalesUsers(): Observable<SalesUserOption[]> {
    return this.http.get<SalesUserOption[]>(`${this.base}/admin/users`);
  }
}
