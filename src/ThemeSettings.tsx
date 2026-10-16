import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from './theme';

export function AppearanceSettings({ value = 'system', onChange, disabled = false }: {
  value?: Appearance;
  onChange: (value: Appearance) => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const options = [
    { value: 'system' as const, label: 'System', icon: Monitor },
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
  ];
  return <section className="appearance-settings" aria-labelledby="appearance-heading">
    <div className="section-header"><h3 id="appearance-heading">Appearance</h3></div>
    <div className="appearance-options" role="group" aria-label="Appearance">
      {options.map(({ value: option, label, icon: Icon }) => <button type="button" key={option}
        aria-pressed={value === option} disabled={disabled} onClick={() => void onChange(option)}>
        <Icon size={19} aria-hidden="true" /><span>{label}</span>
      </button>)}
    </div>
  </section>;
}
