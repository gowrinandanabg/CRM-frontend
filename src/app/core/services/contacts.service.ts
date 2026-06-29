import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactsService {
  private http = inject(HttpClient);

  private readonly apiUrl = `http://${window.location.hostname}:8085/api/v1/contacts`;

  getContacts(): Observable<ContactResponse[]> {
    return this.http.get<ContactResponse[]>(this.apiUrl);
  }
  createContact(contact: any): Observable<ContactResponse> {
  return this.http.post<ContactResponse>(this.apiUrl, contact);
}
}