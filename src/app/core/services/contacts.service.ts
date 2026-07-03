import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth';

export interface ContactResponse {
  id: number;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  jobTitle: string;
  industry: string;
  website: string;
  address: string;
  country: string;
  state: string;
  city: string;
  tags: string;
  notes: string;
  status: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactCreateRequest {
  fullName: string;
  company?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  industry?: string;
  website?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  tags?: string;
  notes?: string;
  status?: string;
  organizationId?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private readonly http = inject(HttpClient);
  private readonly cfg = inject(AppConfigService);
  private readonly auth = inject(AuthService);

  private get apiUrl(): string {
    return `${this.cfg.crmApiUrl}/api/v1/contacts`;
  }

  getContacts(): Observable<ContactResponse[]> {
    return this.http.get<ContactResponse[]>(this.apiUrl);
  }

  createContact(contact: ContactCreateRequest): Observable<ContactResponse> {
    const orgId = this.auth.getOrganizationId();
    const payload = orgId ? { ...contact, organizationId: orgId } : contact;
    return this.http.post<ContactResponse>(this.apiUrl, payload);
  }

  updateContact(id: number, contact: Partial<ContactCreateRequest>): Observable<ContactResponse> {
    return this.http.put<ContactResponse>(`${this.apiUrl}/${id}`, contact);
  }

  deleteContact(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  searchContacts(keyword: string): Observable<ContactResponse[]> {
    return this.http.request<ContactResponse[]>('QUERY', `${this.apiUrl}/search`, {
      body: { keyword }
    });
  }
}
