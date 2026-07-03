import { Component, signal, computed, inject, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of, Subscription, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { OrganizationService } from '../core/services/organization.service';
import { OAppSwitcherComponent, AppItem } from 'orque-ui';
import { AppConfigService } from '../core/services/app-config.service';

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, OAppSwitcherComponent],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private orgSvc = inject(OrganizationService);
  private readonly cfgSvc = inject(AppConfigService);

  private http = inject(HttpClient);
  sidebarCollapsed = signal(localStorage.getItem('crm_sidebar_collapsed') === 'true');
  darkMode = signal(false);

  // Search Results
  showSearchResults = signal(false);
  searchResults = signal<Record<string, any[]>>({});
  searchLoading = signal(false);

  // Notifications
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  showNotifications = signal(false);

  private readonly destroySub = new Subscription();
  private get base(): string { return this.cfgSvc.crmApiUrl; }

  constructor() {
    const isDark = localStorage.getItem('crm_dark_mode') === 'true';
    this.darkMode.set(isDark);
    this.applyTheme(isDark);
  }

  allowedFeatures = signal<string[]>([]);
  featuresLoaded  = signal(false);

  ngOnInit() {
    this.loadNotifications();

    // Always fetch fresh policy from the license API — ensures features reflect the
    // current master license even after a re-login without a page reload.
    this.orgSvc.getMyLicenseStatus().subscribe({
      next: status => {
        const features = status?.features ?? [];
        if (features.length > 0) {
          localStorage.setItem('accesspolicy', JSON.stringify(features));
          this.allowedFeatures.set(features);
        } else {
          // No features from API — fall back to cached policy (e.g. system admin)
          const cached = localStorage.getItem('accesspolicy');
          if (cached) {
            try { this.allowedFeatures.set(JSON.parse(cached)); } catch { /* ignore */ }
          }
        }
        this.featuresLoaded.set(true);
      },
      error: () => {
        // API unavailable — use cached policy if present
        const cached = localStorage.getItem('accesspolicy');
        if (cached) {
          try { this.allowedFeatures.set(JSON.parse(cached)); } catch { /* ignore */ }
        }
        this.featuresLoaded.set(true);
      }
    });

    // Poll notifications every 30 seconds
    this.destroySub.add(interval(30000).subscribe(() => {
      this.loadNotifications();
    }));
  }

  ngOnDestroy() {
    this.destroySub.unsubscribe();
  }

  private hdrs(): HttpHeaders {
    const token = localStorage.getItem('accessToken') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  toggleTheme(): void {
    this.darkMode.update(v => {
      const newVal = !v;
      localStorage.setItem('crm_dark_mode', String(newVal));
      this.applyTheme(newVal);
      return newVal;
    });
  }

  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  // ── Global Search Actions ──
  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    if (!val || val.trim().length < 2) {
      this.showSearchResults.set(false);
      this.searchResults.set({});
      return;
    }

    this.searchLoading.set(true);
    // Use HTTP QUERY method (RFC 10008) — safe, idempotent, body-bearing search request
    this.http.request<Record<string, any[]>>('QUERY', `${this.base}/api/v1/search`, {
      body: { q: val },
      headers: this.hdrs().set('Content-Type', 'application/json')
    })
      .pipe(catchError(() => of({})))
      .subscribe(data => {
        this.searchResults.set(data as Record<string, any[]>);
        this.showSearchResults.set(true);
        this.searchLoading.set(false);
      });
  }

  selectSearchResult(moduleName: string, id: number, item?: any): void {
    let routeName = moduleName.toLowerCase();
    if (item && item.targetModule) {
      routeName = item.targetModule.toLowerCase();
      id = item.targetId;
    }
    if (routeName === 'crm_tasks') routeName = 'tasks';
    this.router.navigate([`/${routeName}/${id}`]);
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    const input = document.getElementById('topbar-search') as HTMLInputElement | null;
    if (input) input.value = '';
    this.showSearchResults.set(false);
    this.searchResults.set({});
  }

  // ── Notification Center Actions ──
  loadNotifications(): void {
    this.http.get<any[]>(`${this.base}/api/v1/notifications`, { headers: this.hdrs() })
      .pipe(catchError(() => of([])))
      .subscribe(data => {
        this.notifications.set(data);
      });

    this.http.get<number>(`${this.base}/api/v1/notifications/unread-count`, { headers: this.hdrs() })
      .pipe(catchError(() => of(0)))
      .subscribe(count => {
        this.unreadCount.set(count);
      });
  }

  toggleNotifications(): void {
    this.showNotifications.update(v => {
      const next = !v;
      if (next) {
        this.markAllAsRead();
      }
      return next;
    });
  }

  markAllAsRead(): void {
    this.http.put(`${this.base}/api/v1/notifications/read-all`, null, { headers: this.hdrs() })
      .subscribe({
        next: () => {
          this.loadNotifications();
        }
      });
  }

  clearNotifications(): void {
    this.markAllAsRead();
  }

  activeMobileGroup = signal<string | null>(null);

  toggleMobileGroup(groupKey: string, event: Event): void {
    if (window.innerWidth <= 1024) {
      event.stopPropagation();
      this.activeMobileGroup.update(current => current === groupKey ? null : groupKey);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMobileGroup.set(null);
  }

  getSafeIcon(iconSvg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(iconSvg);
  }

  isGroupActive(group: NavGroup): boolean {
    return group.items.some(item => this.isActive(item.route));
  }
  searchQuery = signal('');

  currentUser = computed(() => {
    try {
      const raw = localStorage.getItem('crmUser');
      return raw ? JSON.parse(raw) : { name: 'Admin User', role: 'ADMIN' };
    } catch { return { name: 'Admin User', role: 'ADMIN' }; }
  });

  /** Tenant name for the topbar badge.
   *  Prefers the value stored by direct/SSO login; falls back to OPAC's localStorage
   *  key so sessions that pre-date this change still show the badge without re-login. */
  get currentTenantName(): string {
    const fromCrmUser = this.currentUser()?.tenantName;
    if (fromCrmUser) return fromCrmUser;
    // Fallback: OPAC sets this key in the same browser origin
    return localStorage.getItem('opac_tenant_name') || '';
  }

  userRole = computed(() => {
    const u = this.currentUser();
    const role: string = u?.role || u?.roleName || '';
    return role.toUpperCase();
  });

  canManageSystem = computed(() => {
    const r = this.userRole();
    return r === 'ADMIN' || r === 'SALES_ADMIN';
  });

  /** Only true ADMIN can access Customization and Dashboard Builder */
  isAdmin = computed(() => this.userRole() === 'ADMIN');

  navGroups = computed<NavGroup[]>(() => {
    const systemVisible = this.canManageSystem();
    const base: NavGroup[] = [
      {
        label: 'Main',
        items: [
          { key: 'dashboard', label: 'Dashboard', route: '/dashboard',
            icon: `<path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>` },
          { key: 'settings', label: 'Settings', route: '/settings',
            icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>` }
        ]
      },
      {
        label: 'Sales',
        items: [
          { key: 'leads',    label: 'Leads',    route: '/leads',
            icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
          { key: 'contacts', label: 'Contacts', route: '/contacts',
            icon: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
          { key: 'accounts', label: 'Accounts', route: '/accounts',
            icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
          { key: 'deals',    label: 'Deals',    route: '/deals',
            icon: `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>` },
        ]
      },
      {
        label: 'Work',
        items: [
          { key: 'activities', label: 'Activities', route: '/activities',
            icon: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>` },
          { key: 'tasks',      label: 'Tasks',      route: '/tasks',
            icon: `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>` },
          { key: 'calendar',   label: 'Calendar',   route: '/calendar',
            icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
        ]
      },
      {
        label: 'Marketing',
        items: [
          { key: 'campaigns', label: 'Campaigns', route: '/campaigns',
            icon: `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>` },
          { key: 'emails',    label: 'Emails',    route: '/emails',
            icon: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>` },
        ]
      },
      {
        label: 'Commerce',
        items: [
          { key: 'products', label: 'Products', route: '/products',
            icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>` },
          { key: 'quotes',   label: 'Quotes',   route: '/quotes',
            icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>` },
          { key: 'invoices', label: 'Invoices', route: '/invoices',
            icon: `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>` },
          { key: 'inventory', label: 'Inventory', route: '/inventory',
            icon: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
        ]
      },
    ];

    if (systemVisible) {
      base.push({
        label: 'Insights',
        items: [
          { key: 'reports',   label: 'Reports',   route: '/reports',
            icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>` },
          { key: 'report-builder', label: 'Report Builder', route: '/report-builder',
            icon: `<path d="M9 17H5a2 2 0 0 0-2 2v3"/><path d="M15 17h4a2 2 0 0 1 2 2v3"/><path d="M12 2v10"/><polyline points="8 6 12 2 16 6"/>` },
          // Dashboard Builder — ADMIN only
          ...(this.isAdmin() ? [{ key: 'dashboard-builder', label: 'Dash Builder', route: '/dashboard-builder',
            icon: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>` }] : []),
          { key: 'analytics', label: 'Analytics', route: '/analytics',
            icon: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>` },
        ]
      });

      // Platform (Customization) — ADMIN only
      if (this.isAdmin()) {
        base.push({
          label: 'Platform',
          items: [
            { key: 'customization', label: 'Customization', route: '/customization',
              icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>` },
          ]
        });
      }

      base.push({
        label: 'System',
        items: [
          { key: 'users', label: 'Users', route: '/users',
            icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
          { key: 'active-sessions', label: 'Active Sessions', route: '/active-sessions',
            icon: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>` },
        ]
      });
    }

    // While features are loading, show only the always-allowed routes
    if (!this.featuresLoaded()) {
      return base.map(group => ({
        ...group,
        items: group.items.filter(i => i.route === '/dashboard' || i.route === '/settings')
      })).filter(g => g.items.length > 0);
    }

    const raw = this.allowedFeatures();
    // Normalize paths: strip leading /crm/ prefix from legacy license keys
    const features = raw.map(f => f.startsWith('/crm/') ? f.replace('/crm/', '/') : f);

    // If no features at all (SYSTEM_ADMIN / platform owner) — show everything
    if (features.length === 0) {
      return base;
    }

    return base.map(group => {
      const items = group.items.filter(item => {
        if (item.route === '/dashboard' || item.route === '/settings') return true;
        return features.includes(item.route);
      });
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  });

  // ── App Switcher ─────────────────────────────────────────────────────────
  get appSwitcherApps(): AppItem[] {
    return [{
      key: 'opac',
      label: 'OPAC',
      desc: 'Admin Center',
      iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      color: '#0f3460',
      action: () => window.open(this.cfgSvc.opacAppUrl, '_blank')
    }];
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => {
      const newVal = !v;
      localStorage.setItem('crm_sidebar_collapsed', String(newVal));
      return newVal;
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }
}
