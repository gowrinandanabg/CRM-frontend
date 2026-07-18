import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OStatCardComponent, PageStoreService } from 'orque-ui';
import { DashboardService, SalesUserOption } from '../../core/services/dashboard.service';

type CardType = 'kpi' | 'pipeline' | 'activity' | 'quick_actions' | 'email_stats';

/** A card in a saved custom dashboard, keyed the same way the Dashboard Builder saves
 *  it — reuses the exact same cards as the default dashboard below (kpi -> o-stat-card,
 *  pipeline/activity/quick_actions/email_stats -> the same dash-card sections), just
 *  picked/arranged differently. No bespoke widget UI. */
interface CustomWidget {
  key: string;
  type: CardType;
  title: string;
}

/** Order matches the this.kpis() array built in buildDashboard() below, so a saved
 *  kpi card's live label/value/color/icon can be looked up by index. */
const KPI_KEYS = ['revenue', 'pipelineValue', 'leads', 'contacts', 'tasks', 'campaigns'];

/** Same fixed card catalog the Dashboard Builder offers — titles for the non-kpi cards. */
const CARD_TITLES: Record<string, string> = {
  pipeline: 'Deal Pipeline',
  activity: 'Recent Activities',
  quick_actions: 'Quick Actions',
  email_stats: 'Email Performance',
};

interface KpiCard {
  label: string; value: string | number; sub: string;
  trend: string; trendUp: boolean;
  color: string; iconPath: string;
}

interface SessionCard {
  label: string; value: number; sub: string;
  color: string; iconPath: string;
}

interface PipelineStage {
  label: string; count: number; amount: string; pct: number; color: string;
}

interface RecentActivity {
  type: string; subject: string; contact: string;
  time: string; icon: string; color: string;
}

interface QuickAction {
  label: string; route: string; icon: string; color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OStatCardComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly store = inject(PageStoreService);
  private readonly dashboardService = inject(DashboardService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = signal(true);
  dashboards = signal<any[]>([]);

  // Collapses the header action row (filters/toggles/buttons) for a cleaner look.
  actionsCollapsed = signal(false);

  // Custom (saved) dashboard view — when set, the page renders these widgets in
  // place instead of the default KPI/pipeline layout, no navigation involved.
  activeCustomDashboard = signal<any | null>(null);
  customWidgets = signal<CustomWidget[]>([]);

  // Admin user-picker
  salesUsers = signal<SalesUserOption[]>([]);
  selectedUsername = signal<string>('');  // '' = combined (all users) for admin

  // Dashboard Polish properties
  refreshIntervalRate = signal<number>(0);
  dateFilter = signal<string>('all');
  isCustomizing = signal<boolean>(false);
  sharedWithLabel = signal<string>('Shared with: All Sales & Admins');

  // Widget size settings
  widgetSizes = signal<Record<string, 'wide' | 'medium' | 'narrow'>>({
    pipeline: 'medium',
    activity: 'medium',
    quick: 'medium',
    email: 'medium'
  });

  private refreshTimer: any = null;

  currentUser = computed(() => {
    try {
      const raw = localStorage.getItem('crmUser');
      return raw ? JSON.parse(raw) : { name: 'Admin User', role: 'ADMIN' };
    } catch { return { name: 'Admin User', role: 'ADMIN' }; }
  });

  userRole = computed(() => {
    const u = this.currentUser();
    const role: string = u?.role || u?.roleName || '';
    return role.toUpperCase();
  });

  isAdmin = computed(() => {
    const r = this.userRole();
    return r === 'ADMIN' || r === 'SALES_ADMIN' || r === 'SYSTEM_ADMIN';
  });

  isSalesUser = computed(() => {
    const r = this.userRole();
    return r === 'SALES' || r === 'SALES_USER';
  });

  selectedUserLabel = computed(() => {
    const u = this.selectedUsername();
    if (!u) return 'All Users (Combined)';
    const found = this.salesUsers().find(x => x.username === u);
    return found?.displayName?.trim() || u;
  });

  kpis         = signal<KpiCard[]>([]);
  sessionCards = signal<SessionCard[]>([]);
  pipeline     = signal<PipelineStage[]>([]);
  activities   = signal<RecentActivity[]>([]);
  emailStats   = signal<{ label: string; value: string; pct: number; color: string }[]>([]);

  // Ticks every minute so the greeting flips from "morning" to "afternoon" etc. live,
  // instead of freezing at whatever it was when the page first loaded.
  private readonly clockTick = signal(Date.now());
  greeting = computed(() => {
    const h = new Date(this.clockTick()).getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });
  private clockTimer: any = null;

  readonly quickActions: QuickAction[] = [
    { label: 'New Lead',     route: '/leads',     color: '#0F3460',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11V7M12 8H6' },
    { label: 'New Contact',  route: '/contacts',  color: '#0EA5E9',
      icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { label: 'New Deal',     route: '/deals',     color: '#16A34A',
      icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { label: 'New Task',     route: '/tasks',     color: '#F59E0B',
      icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    { label: 'New Campaign', route: '/campaigns', color: '#EF4444',
      icon: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' },
    { label: 'New Invoice',  route: '/invoices',  color: '#0A2342',
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  ];

  private static readonly VIEW_AS_KEY = 'crm_dashboard_view_as';

  ngOnInit(): void {
    this.loadWidgetSizes();
    if (this.isAdmin()) {
      const savedViewAs = localStorage.getItem(DashboardComponent.VIEW_AS_KEY);
      if (savedViewAs !== null) this.selectedUsername.set(savedViewAs);
      this.dashboardService.getSalesUsers().pipe(catchError(() => of([]))).subscribe(users => {
        this.salesUsers.set(users);
      });
    }
    this.loadDashboardData();
    this.loadCustomDashboards();
    this.clockTimer = setInterval(() => this.clockTick.set(Date.now()), 60_000);
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  loadCustomDashboards() {
    this.store.get('/api/v1/crm-dashboards')
      .pipe(catchError(() => of([])))
      .subscribe((list: any) => {
        this.dashboards.set(list || []);
        const lastId = Number(localStorage.getItem('crm_last_dashboard_id'));
        const toRestore = lastId ? (list || []).find((d: any) => d.id === lastId) : null;
        if (toRestore) this.selectCustomDashboard(toRestore);
        // Force the dashboard-switcher <select>'s [value] binding to sync now — this
        // runs inside an async subscribe callback, so without this the DOM can lag
        // behind activeCustomDashboard() until some unrelated change triggers detection.
        this.cdr.detectChanges();
      });
  }

  /** Bound to the switcher's ngModelChange (emits 'default' or the picked dashboard's id). */
  onDashboardPicked(value: string | number): void {
    if (value === 'default') {
      localStorage.removeItem('crm_last_dashboard_id');
      this.activeCustomDashboard.set(null);
      this.customWidgets.set([]);
      return;
    }
    const dash = this.dashboards().find((d: any) => d.id === Number(value));
    if (dash) this.selectCustomDashboard(dash);
  }

  /** Selects a saved dashboard view in place and remembers it (crm_last_dashboard_id)
   *  so a page refresh reopens the same view instead of resetting to Default. */
  private selectCustomDashboard(dash: any): void {
    localStorage.setItem('crm_last_dashboard_id', String(dash.id));
    this.activeCustomDashboard.set(dash);
    try {
      const savedKeys: { key: string }[] = JSON.parse(dash.layoutConfig || '[]');
      this.customWidgets.set(savedKeys.map(sw => this.toCustomWidget(sw.key)).filter((w): w is CustomWidget => !!w));
    } catch {
      this.customWidgets.set([]);
    }
  }

  private toCustomWidget(key: string): CustomWidget | null {
    if (KPI_KEYS.includes(key)) return { key, type: 'kpi', title: '' };
    if (CARD_TITLES[key]) return { key, type: key as CardType, title: CARD_TITLES[key] };
    return null;
  }

  /** Live label/value/color/icon for a saved kpi card, sourced from the same kpis()
   *  signal the default KPI grid below renders — so the custom view always matches. */
  getCustomKpi(key: string): KpiCard | undefined {
    return this.kpis()[KPI_KEYS.indexOf(key)];
  }

  hasCustomKpis(): boolean {
    return this.customWidgets().some(w => w.type === 'kpi');
  }

  onUserPickerChange(username: string): void {
    this.selectedUsername.set(username);
    localStorage.setItem(DashboardComponent.VIEW_AS_KEY, username);
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    const scopeUsername = this.isAdmin() ? (this.selectedUsername() || null) : null;
    const fetchSessions = this.isSalesUser()
      ? of(null)
      : this.store.get('/api/v1/sessions/stats').pipe(catchError(() => of(null)));
    // Previously /deals and /activities were fetched unscoped, so picking "View as: <salesperson>"
    // correctly filtered the summary KPI numbers (backend takes an explicit scopedUsername) but left
    // the Deal Pipeline chart and Recent Activities list showing every salesperson's records —
    // visibly contradicting the KPIs sitting right above them. Pass the same scope through here too.
    const scopeQuery = scopeUsername ? `?assignedTo=${encodeURIComponent(scopeUsername)}` : '';

    forkJoin({
      summary:  this.dashboardService.getDashboardSummary(scopeUsername).pipe(catchError(() => of(null))),
      deals:    this.store.getList(`/api/v1/deals${scopeQuery}`).pipe(catchError(() => of([]))),
      acts:     this.store.getList(`/api/v1/activities${scopeQuery}`).pipe(catchError(() => of([]))),
      sessions: fetchSessions,
    }).subscribe(({ summary, deals, acts, sessions }) => {
      this.buildDashboard(summary, deals, acts, sessions);
    });
  }

  loadWidgetSizes() {
    const saved = localStorage.getItem('crmDashboardWidgetSizes');
    if (saved) {
      try { this.widgetSizes.set(JSON.parse(saved)); } catch {}
    }
  }

  setWidgetSize(widget: string, size: 'wide' | 'medium' | 'narrow') {
    this.widgetSizes.update(sizes => {
      const updated = { ...sizes, [widget]: size };
      localStorage.setItem('crmDashboardWidgetSizes', JSON.stringify(updated));
      return updated;
    });
  }

  onRefreshRateChange(rate: number) {
    this.refreshIntervalRate.set(rate);
    this.clearRefreshTimer();
    if (rate > 0) {
      this.refreshTimer = setInterval(() => {
        this.loadDashboardData();
      }, rate * 1000);
    }
  }

  clearRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  onFilterChange(filterVal: string) {
    this.dateFilter.set(filterVal);
    this.loadDashboardData();
  }

  private buildDashboard(d: any, deals: any[], acts: any[], sessions: any): void {
    // Exact-match against the real stage values (see deals.json's `stage` field options:
    // Prospecting/Qualification/Proposal/Negotiation/Closed Won/Closed Lost) rather than a
    // substring check — a substring check on 'won' happens to work for "Closed Won" but is
    // fragile, and there was no equivalent handling for "Closed Lost" at all.
    const stageOf = (x: any) => (x.stage || x.status || '').trim().toLowerCase();
    const wonDeals  = deals.filter((x: any) => stageOf(x) === 'closed won');
    const openDeals = deals.filter((x: any) => stageOf(x) !== 'closed won' && stageOf(x) !== 'closed lost');

    // Revenue Generated and Pipeline Value must both come from the same source (Deals) as
    // their own subtitles and the "Deal Pipeline" chart directly below them. They previously
    // preferred a backend-computed number that actually aggregated the Leads module's
    // estimated_value field instead — a different module with its own separate pipeline
    // (see Lead.pipelineStage) — so the headline figure and its subtitle/chart could easily
    // disagree, and neither reliably matched what you'd find by checking Deals directly.
    // Pipeline Value only makes sense as the sum of still-open opportunities: previously this
    // summed every deal's amount, including Closed Won and Closed Lost ones.
    const pipelineValue    = openDeals.reduce((s: number, x: any) => s + (x.amount || 0), 0);
    const revenueGenerated = wonDeals.reduce((s: number, x: any) => s + (x.amount || 0), 0);

    const totalLeads    = d?.totalLeads    ?? 0;
    const hotLeads      = d?.hotLeads      ?? 0;
    const totalContacts = d?.totalContacts ?? 0;
    const tasksDueToday = d?.tasksDueToday ?? 0;
    const totalCampaigns = d?.totalCampaigns ?? 0;
    const emailsSent    = d?.emailsSent    ?? 0;
    const emailsOpened  = d?.emailsOpened  ?? 0;
    const emailsReplied = d?.emailsReplied ?? 0;

    const wonSub     = `${wonDeals.length} Closed Won ${this.pluralize(wonDeals.length, 'deal')}`;
    // Was deals.length (every deal, including Closed Won/Lost ones) mislabeled as "open".
    const dealSub    = `${openDeals.length} open ${this.pluralize(openDeals.length, 'deal')}`;
    const hotLeadSub = hotLeads > 0
      ? `${hotLeads} hot ${this.pluralize(hotLeads, 'lead')}`
      : 'None qualified yet';

    this.kpis.set([
      {
        label: 'Revenue Generated',
        value: this.formatCrore(revenueGenerated),
        sub: wonSub, trend: 'This period', trendUp: true, color: '#0F3460',
        iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'
      },
      {
        label: 'Pipeline Value',
        value: this.formatCrore(pipelineValue),
        sub: dealSub, trend: 'Active', trendUp: true, color: '#16A34A',
        iconPath: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'
      },
      {
        label: 'Total Leads',
        value: totalLeads,
        sub: hotLeadSub, trend: 'Total', trendUp: true, color: '#F59E0B',
        iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
      },
      {
        label: 'Total Contacts',
        value: totalContacts,
        sub: 'Across all accounts',
        trend: 'Contacts', trendUp: true, color: '#0EA5E9',
        iconPath: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
      },
      {
        label: 'Tasks Due Today',
        value: tasksDueToday,
        sub: tasksDueToday > 0 ? 'Need attention' : 'All clear',
        trend: tasksDueToday > 0 ? 'Overdue' : 'On track',
        trendUp: tasksDueToday === 0, color: '#EF4444',
        iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
      },
      {
        label: 'Active Campaigns',
        value: totalCampaigns,
        sub: emailsSent > 0 ? `${emailsSent.toLocaleString()} emails sent` : 'No emails sent yet',
        trend: 'Running', trendUp: true, color: '#0A2342',
        iconPath: 'M22 12h-6l-2 3h-4l-2-3H2'
      },
    ]);

    // Session stat cards (compact variant)
    const active   = sessions?.activeSessions ?? 0;
    const online   = sessions?.onlineUsers    ?? 0;
    const logins   = sessions?.todayLogins    ?? 0;
    this.sessionCards.set([
      {
        label: 'Active Sessions', value: active,
        sub: active === 1 ? '1 session open' : `${active} sessions open`,
        color: '#0F3460',
        iconPath: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2'
      },
      {
        label: 'Online Users', value: online,
        sub: 'Currently logged in',
        color: '#16A34A',
        iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
      },
      {
        label: "Today's Logins", value: logins,
        sub: 'Login events today',
        color: '#0EA5E9',
        iconPath: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6'
      },
    ]);

    // Pipeline
    const stages = [
      { label: 'Prospecting',   keywords: ['prospecting'],   count: 0, total: 0, color: '#94A3B8' },
      { label: 'Qualification', keywords: ['qualification'], count: 0, total: 0, color: '#60A5FA' },
      { label: 'Proposal',      keywords: ['proposal'],      count: 0, total: 0, color: '#3B82F6' },
      { label: 'Negotiation',   keywords: ['negotiation'],   count: 0, total: 0, color: '#0F3460' },
      { label: 'Closed Won',    keywords: ['won'],           count: 0, total: 0, color: '#16A34A' },
    ];
    deals.forEach((deal: any) => {
      const s = (deal.stage || deal.status || '').toLowerCase();
      const st = stages.find(x => x.keywords.some(k => s.includes(k)));
      if (st) { st.count++; st.total += (deal.amount || 0); }
    });
    const maxAmt = Math.max(...stages.map(s => s.total), 1);
    this.pipeline.set(stages.map(s => ({
      label: s.label, count: s.count,
      amount: s.total > 0 ? this.formatLakh(s.total) : '—',
      pct: s.total > 0 ? Math.max(8, Math.round((s.total / maxAmt) * 100)) : 0,
      color: s.color
    })));

    // Recent activities
    const typeConfig: Record<string, { icon: string; color: string }> = {
      Call:    { color: '#0F3460', icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.33 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
      Email:   { color: '#0EA5E9', icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
      Meeting: { color: '#16A34A', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0 0' },
      Task:    { color: '#F59E0B', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    };
    this.activities.set(acts.slice(0, 6).map((a: any) => {
      const cfg = typeConfig[a.type] || { color: '#6B7280', icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' };
      return {
        type:    a.type    || 'Activity',
        subject: a.subject || a.title || '—',
        contact: a.contact || a.assignedTo || '—',
        time:    a.dueDate || a.createdAt || '',
        ...cfg
      };
    }));

    // Email stats
    const openRate  = emailsSent  > 0 ? Math.round((emailsOpened  / emailsSent)  * 100) : 0;
    const replyRate = emailsOpened > 0 ? Math.round((emailsReplied / emailsOpened) * 100) : 0;
    this.emailStats.set([
      { label: 'Sent',    value: emailsSent.toLocaleString(),    pct: 100,       color: '#0F3460' },
      { label: 'Opened',  value: emailsOpened.toLocaleString(),  pct: openRate,  color: '#16A34A' },
      { label: 'Replied', value: emailsReplied.toLocaleString(), pct: replyRate, color: '#0EA5E9' },
    ]);

    this.loading.set(false);
  }

  private formatCrore(v: number): string {
    if (!v) return '₹0';
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
  }

  private formatLakh(v: number): string {
    if (!v) return '—';
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
  }

  private pluralize(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
  }

  getWidgetFlex(widget: string): string {
    const size = this.widgetSizes()[widget] || 'medium';
    if (size === 'wide') return '1 1 100%';
    if (size === 'narrow') return '1 1 calc(33.3% - 16px)';
    return '1 1 calc(50% - 12px)';
  }
}
