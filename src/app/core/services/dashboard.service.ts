import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);

  private readonly apiUrl = `http://${window.location.hostname}:8085/api/v1/reports/dashboard`;

  getDashboardSummary(): Observable<DashboardSummaryResponse> {
    return this.http.get<DashboardSummaryResponse>(this.apiUrl);
  }
}