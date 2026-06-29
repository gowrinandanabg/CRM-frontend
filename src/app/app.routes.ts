import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './layout/main-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'leads' }
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'contacts' }
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'accounts' }
      },
      {
        path: 'deals',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'deals' }
      },
      {
        path: 'deals/:id',
        loadComponent: () =>
          import('./features/record-detail/record-detail').then(m => m.RecordDetailComponent),
        data: { resource: 'deals' }
      },
      {
        path: 'contacts/:id',
        loadComponent: () =>
          import('./features/record-detail/record-detail').then(m => m.RecordDetailComponent),
        data: { resource: 'contacts' }
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('./features/record-detail/record-detail').then(m => m.RecordDetailComponent),
        data: { resource: 'accounts' }
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'activities' }
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'tasks' }
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'calendar' }
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'campaigns' }
      },
      {
        path: 'emails',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'emails' }
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'products' }
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'quotes' }
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'invoices' }
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports').then(m => m.ReportsComponent)
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/reports/reports').then(m => m.ReportsComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'users' }
      },
      {
        path: 'active-sessions',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'active-sessions' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/user-settings/user-settings').then(m => m.UserSettingsComponent)
      },
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];
