import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OToastComponent } from 'orque-ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, OToastComponent],
  template: `<router-outlet /><o-toast />`,
  styles: [`
    :host { display: block; height: 100%; }
  `]
})
export class App {}
