import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './layout/main-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'sso',
    loadComponent: () => import('./features/auth/sso/sso').then(m => m.SsoComponent)
  },
  {
    path: 'license-pending',
    loadComponent: () => import('./features/license/license-pending').then(m => m.LicensePendingComponent),
    canActivate: [authGuard]
  },

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
        path: 'leads/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'leads' }
      },
      {
        path: 'deals/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'deals' }
      },
      {
        path: 'contacts/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
        data: { resource: 'contacts' }
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('orque-ui').then(m => m.RecordDetailComponent),
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
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'reports' }
      },
      {
        path: 'report-builder',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'report-builder' }
      },
      {
        path: 'customization',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'customization' },
        canActivate: [authGuard]
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'inventory' }
      },
      {
        path: 'dashboard-builder',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'dashboard-builder' },
        canActivate: [authGuard]
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/list-page/list-page').then(m => m.ListPageComponent),
        data: { resource: 'user-settings' }
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
        path: 'system-admin',
        loadComponent: () =>
          import('./features/system-admin/system-admin').then(m => m.SystemAdminComponent),
        canActivate: [authGuard, adminGuard]
      },
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];
