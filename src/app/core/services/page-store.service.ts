import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { PageConfig } from 'orque-ui';

@Injectable({ providedIn: 'root' })
export class PageStoreService {
  private readonly http = inject(HttpClient);
  private readonly configCache = new Map<string, PageConfig>();
  private readonly apiBase = `http://${globalThis.location.hostname}:8085`;

  getPageConfig(resource: string): Observable<PageConfig> {
    const cached = this.configCache.get(resource);
    if (cached) return of(cached);
    return this.http.get<PageConfig>(`/page-configs/${resource}.json`).pipe(
      tap(config => this.configCache.set(resource, config)),
      catchError(() => of({} as PageConfig))
    );
  }

  getList(api: string): Observable<any[]> {
    const url = api.startsWith('http') ? api : `${this.apiBase}${api}`;
    return this.http.get<any>(url, { headers: this.headers() }).pipe(
      map(r => {
        if (Array.isArray(r)) return r;
        return r?.data ?? r?.content ?? r?.items ?? r?.result ?? [];
      }),
      catchError(() => of([]))
    );
  }

  get(api: string): Observable<any> {
    const url = api.startsWith('http') ? api : `${this.apiBase}${api}`;
    return this.http.get<any>(url, { headers: this.headers() });
  }

  post(api: string, payload: any): Observable<any> {
    const url = api.startsWith('http') ? api : `${this.apiBase}${api}`;
    return this.http.post<any>(url, payload, { headers: this.headers() });
  }

  put(api: string, payload: any): Observable<any> {
    const url = api.startsWith('http') ? api : `${this.apiBase}${api}`;
    return this.http.put<any>(url, payload, { headers: this.headers() });
  }

  delete(api: string): Observable<any> {
    const url = api.startsWith('http') ? api : `${this.apiBase}${api}`;
    return this.http.delete<any>(url, { headers: this.headers() });
  }

  clearConfigCache(): void {
    this.configCache.clear();
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || '';
    return new HttpHeaders({ ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  }
}
