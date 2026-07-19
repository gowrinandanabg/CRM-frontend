import { ChangeDetectorRef, Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ORQUE_API_URL, OStatCardComponent, OToastService } from 'orque-ui';

type CardType = 'kpi' | 'pipeline' | 'activity' | 'quick_actions' | 'email_stats';

/** The fixed catalog of cards — identical set (same title/color/icon) as the ones
 *  rendered on the default Dashboard page. The builder only lets you pick which of
 *  these to include, it never invents new card types or styling. */
interface CardDef {
  key: string;
  type: CardType;
  title: string;
  color?: string;
  iconPath?: string;
}

/** A card the user has selected into the dashboard being built. */
interface Widget {
  key: string;
  type: CardType;
  title: string;
  color?: string;
  iconPath?: string;
  value?: string | number;
}

interface Dashboard { id?: number; name: string; shareType: string; layoutConfig: string; }

@Component({
  selector: 'app-crm-dashboard-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OStatCardComponent],
  templateUrl: './crm-dashboard-builder.html',
  styleUrls: ['./crm-dashboard-builder.scss']
})
export class CrmDashboardBuilderComponent implements OnInit {
  private http = inject(HttpClient);
  private base = `${inject(ORQUE_API_URL)}/api/v1`;
  private toast = inject(OToastService);
  private cdr = inject(ChangeDetectorRef);

  dashboards = signal<Dashboard[]>([]);
  selectedDashboard = signal<Dashboard | null>(null);
  widgets = signal<Widget[]>([]);
  showCreateDash = signal(false);
  showSelectCards = signal(false);

  newDash: Dashboard = { name: '', shareType: 'PRIVATE', layoutConfig: '[]' };

  // Same cards, same titles/colors/icons as the default Dashboard's KPI grid + section cards.
  readonly availableCards: CardDef[] = [
    { key: 'revenue', type: 'kpi', title: 'Revenue Generated', color: '#0F3460',
      iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { key: 'pipelineValue', type: 'kpi', title: 'Pipeline Value', color: '#16A34A',
      iconPath: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' },
    { key: 'leads', type: 'kpi', title: 'Total Leads', color: '#F59E0B',
      iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { key: 'contacts', type: 'kpi', title: 'Total Contacts', color: '#0EA5E9',
      iconPath: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { key: 'tasks', type: 'kpi', title: 'Tasks Due Today', color: '#EF4444',
      iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    { key: 'campaigns', type: 'kpi', title: 'Active Campaigns', color: '#0A2342',
      iconPath: 'M22 12h-6l-2 3h-4l-2-3H2' },
    // Icons below reused verbatim from the same-named nav items / quick actions
    // elsewhere in the app (Deals, Activities, Tasks, Campaigns) — not new icons.
    { key: 'pipeline', type: 'pipeline', title: 'Deal Pipeline', color: '#16A34A',
      iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { key: 'activity', type: 'activity', title: 'Recent Activities', color: '#0F3460',
      iconPath: 'M22 12h-4l-3 9L9 3l-3 9H2' },
    { key: 'quick_actions', type: 'quick_actions', title: 'Quick Actions', color: '#F59E0B',
      iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    { key: 'email_stats', type: 'email_stats', title: 'Email Performance', color: '#EF4444',
      iconPath: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' },
  ];

  // Same Quick Actions used on the default Dashboard — reused verbatim, not reinvented.
  readonly quickActions = [
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

  selectedKeys = computed(() => new Set(this.widgets().map(w => w.key)));

  private kpiValues: Record<string, string | number> = {};

  // Distinct from dashboard.ts's 'crm_last_dashboard_id' — that key remembers which
  // saved view the Dashboard page displays. This one is builder-only ("which dashboard
  // was I last editing here"). Sharing a single key made switching views in either
  // page silently override the other's remembered selection.
  private static readonly LAST_DASHBOARD_KEY = 'crm_dashboard_builder_last_id';

  ngOnInit() {
    this.loadKpiValues();
    this.loadDashboards();
  }

  /** Live values for the KPI cards, same source (/dashboard/summary) the default Dashboard uses. */
  loadKpiValues() {
    this.http.get<any>(`${this.base}/dashboard/summary`)
      .pipe(catchError(() => of({})))
      .subscribe((data: any) => {
        this.kpiValues = {
          revenue: data?.revenueGenerated ? `₹${Math.round(data.revenueGenerated).toLocaleString('en-IN')}` : '₹0',
          pipelineValue: data?.pipelineValue ? `₹${Math.round(data.pipelineValue).toLocaleString('en-IN')}` : '₹0',
          leads: data?.totalLeads ?? 0,
          contacts: data?.totalContacts ?? 0,
          tasks: data?.tasksDueToday ?? 0,
          campaigns: data?.totalCampaigns ?? 0,
        };
        // Refresh already-selected kpi widgets with live values.
        this.widgets.update(list => list.map(w =>
          w.type === 'kpi' && this.kpiValues[w.key] !== undefined ? { ...w, value: this.kpiValues[w.key] } : w
        ));
      });
  }

  /**
   * Restores whichever saved dashboard the user was last viewing (remembered across
   * reloads via localStorage), or the first one available. Only falls back to a
   * sensible starter set when there's genuinely nothing saved yet.
   */
  loadDashboards() {
    this.http.get<Dashboard[]>(`${this.base}/crm-dashboards`)
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        this.dashboards.set(list);
        if (list.length === 0) {
          this.widgets.set(this.availableCards.map(c => this.toWidget(c)));
          return;
        }
        const lastId = Number(localStorage.getItem(CrmDashboardBuilderComponent.LAST_DASHBOARD_KEY));
        const toSelect = list.find(d => d.id === lastId) ?? list[0];
        this.selectDashboard(toSelect);
      });
  }

  private toWidget(c: CardDef): Widget {
    return { key: c.key, type: c.type, title: c.title, color: c.color, iconPath: c.iconPath, value: this.kpiValues[c.key] };
  }

  selectDashboard(dash: Dashboard) {
    this.selectedDashboard.set(dash);
    if (dash.id != null) {
      localStorage.setItem(CrmDashboardBuilderComponent.LAST_DASHBOARD_KEY, String(dash.id));
    }
    try {
      // Trust the saved layout as-is, including a genuinely empty ([]) dashboard —
      // falling back to whatever was already on screen would mean an intentionally-cleared
      // dashboard would still show stale widgets after selecting it.
      const savedKeys: { key: string }[] = JSON.parse(dash.layoutConfig || '[]');
      const widgets = savedKeys
        .map(sw => this.availableCards.find(c => c.key === sw.key))
        .filter((c): c is CardDef => !!c)
        .map(c => this.toWidget(c));
      this.widgets.set(widgets);
    } catch {
      this.widgets.set([]);
    }
    // Force the switcher <select>'s [ngModel] and the rendered card list to sync
    // immediately — this can be called from inside an async subscribe callback,
    // where the DOM would otherwise lag until some unrelated change triggers detection.
    this.cdr.detectChanges();
  }

  /**
   * Bound to the <select>'s ngModelChange (emits the picked dashboard's id, a number).
   * Fetches that dashboard fresh from the backend rather than trusting the locally
   * cached `dashboards()` array — the array is only populated once at load time, so
   * any edit made to a *different* dashboard elsewhere in the same session (or by
   * someone else, for a TEAM-shared one) wouldn't be reflected in it, and switching
   * would appear to silently show stale/wrong content.
   */
  onDashboardPicked(id: number): void {
    this.http.get<Dashboard>(`${this.base}/crm-dashboards/${id}`)
      .pipe(catchError(() => of(this.dashboards().find(d => d.id === id) ?? null)))
      .subscribe(dash => {
        if (!dash) return;
        this.dashboards.update(list => list.map(d => d.id === dash.id ? dash : d));
        this.selectDashboard(dash);
      });
  }

  /**
   * Starts a genuinely new, independent dashboard. Without this, "Save Dashboard"
   * always overwrote whichever dashboard was currently selected — there was no way
   * to reach the create flow again once one existed, so every "new" view actually
   * just clobbered the previous one's card selection.
   */
  newDashboard() {
    this.selectedDashboard.set(null);
    this.widgets.set([]);
    localStorage.removeItem(CrmDashboardBuilderComponent.LAST_DASHBOARD_KEY);
    this.showSelectCards.set(true);
  }

  shareTypeLabel(shareType: string): string {
    const map: Record<string, string> = { PRIVATE: 'Private', TEAM: 'Team', PUBLIC: 'Public' };
    return map[(shareType || '').toUpperCase()] || shareType;
  }

  createDashboard() {
    if (!this.newDash.name) return;
    // Post a fresh object with no `id` — guarantees the backend takes the insert
    // branch (CrmDashboardService.saveDashboard treats a null id as "create new"),
    // never accidentally updates whatever was previously selected.
    const toCreate: Dashboard = { name: this.newDash.name, shareType: this.newDash.shareType, layoutConfig: JSON.stringify(this.widgets().map(w => ({ key: w.key }))) };
    this.http.post<Dashboard>(`${this.base}/crm-dashboards`, toCreate)
      .subscribe({
        next: d => {
          // Defensively de-dupe by id in case of a double-click/retry — never want
          // two entries in the list pointing at the same backend row.
          this.dashboards.update(list => [...list.filter(x => x.id !== d.id), d]);
          this.selectDashboard(d);
          this.showCreateDash.set(false);
          this.newDash = { name: '', shareType: 'PRIVATE', layoutConfig: '[]' };
          this.toast.addSuccess('Dashboard created', `"${d.name}" has been created.`);
        },
        error: () => this.toast.addError('Save failed', 'Could not create the dashboard. Please try again.')
      });
  }

  /** Toggled from the Select Cards popup — same cards as the Dashboard, just check/uncheck. */
  toggleCard(card: CardDef, checked: boolean) {
    if (checked) {
      if (this.selectedKeys().has(card.key)) return;
      this.widgets.update(list => [...list, this.toWidget(card)]);
    } else {
      this.widgets.update(list => list.filter(w => w.key !== card.key));
    }
  }

  removeWidget(key: string) {
    this.widgets.update(list => list.filter(w => w.key !== key));
  }

  saveDashboard() {
    const current = this.selectedDashboard();
    if (!current) { this.showCreateDash.set(true); return; }
    // Clone rather than mutate `current` in place — it's the same object reference
    // stored inside dashboards()'s array, and mutating it directly before the POST
    // resolves could leave stale/inconsistent state if the request fails or races
    // with another update.
    const toSave: Dashboard = { ...current, layoutConfig: JSON.stringify(this.widgets().map(w => ({ key: w.key }))) };
    this.http.post<Dashboard>(`${this.base}/crm-dashboards`, toSave)
      .subscribe({
        next: saved => {
          this.dashboards.update(list => list.map(d => d.id === saved.id ? saved : d));
          // Keep selectedDashboard pointing at the server's copy — without this it
          // kept referencing the pre-save object, and identical layoutConfig strings
          // (e.g. no actual card changes) meant this rarely surfaced, masking the bug.
          this.selectedDashboard.set(saved);
          this.toast.addSuccess('Dashboard saved', `"${saved.name}" has been updated.`);
        },
        error: () => this.toast.addError('Save failed', 'Could not save the dashboard. Please try again.')
      });
  }

  /** Deletes the currently selected dashboard and falls back to another one (or the
   *  empty/new-dashboard state if none remain). Previously there was no way to remove
   *  a bad/duplicated dashboard at all — the backend DELETE endpoint already existed
   *  but nothing in the UI called it. */
  deleteDashboard() {
    const dash = this.selectedDashboard();
    if (!dash?.id) return;
    this.http.delete<void>(`${this.base}/crm-dashboards/${dash.id}`)
      .subscribe({
        next: () => {
          const remaining = this.dashboards().filter(d => d.id !== dash.id);
          this.dashboards.set(remaining);
          if (remaining.length > 0) {
            this.selectDashboard(remaining[0]);
          } else {
            this.newDashboard();
          }
          this.toast.addSuccess('Dashboard deleted', `"${dash.name}" has been removed.`);
        },
        error: () => this.toast.addError('Delete failed', 'Could not delete the dashboard. Please try again.')
      });
  }

  // Sample data for the pipeline/activity/email widget previews — same shape the
  // default Dashboard computes from live deals/activities data.
  samplePipeline(): { label: string; count: number; amount: string; pct: number; color: string }[] {
    return [
      { label: 'Prospecting', count: 12, amount: '₹8,40,000', pct: 85, color: '#94A3B8' },
      { label: 'Qualification', count: 8, amount: '₹5,20,000', pct: 60, color: '#60A5FA' },
      { label: 'Proposal', count: 5, amount: '₹3,10,000', pct: 45, color: '#3B82F6' },
      { label: 'Negotiation', count: 3, amount: '₹1,80,000', pct: 30, color: '#0F3460' },
      { label: 'Closed Won', count: 2, amount: '₹1,20,000', pct: 20, color: '#16A34A' },
    ];
  }

  sampleActivities(): { type: string; subject: string; contact: string; time: string; icon: string; color: string }[] {
    return [
      { type: 'Call', subject: 'Follow-up call', contact: 'Acme Corp', time: 'Today', color: '#0F3460',
        icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.33 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
      { type: 'Email', subject: 'Proposal sent', contact: 'Beta LLC', time: 'Yesterday', color: '#0EA5E9',
        icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
      { type: 'Meeting', subject: 'Demo scheduled', contact: 'Gamma Inc', time: '2 days ago', color: '#16A34A',
        icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0 0' },
    ];
  }

  sampleEmailStats(): { label: string; value: string; pct: number; color: string }[] {
    return [
      { label: 'Sent', value: '1,240', pct: 100, color: '#0F3460' },
      { label: 'Opened', value: '780', pct: 63, color: '#16A34A' },
      { label: 'Replied', value: '210', pct: 27, color: '#0EA5E9' },
    ];
  }

}
