import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { TabsList, TabsTrigger } from './ui.jsx';

type HeaderProps = { eyebrow?: string; title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode };

export function PageHeader({ eyebrow, title, subtitle, action, back }: HeaderProps) {
  return <header className="page-header native-page-header">
    <div className="page-masthead">{back ?? <span className="setline-wordmark">Setline<span aria-hidden="true">.</span></span>}{back ? <span className="setline-wordmark">Setline<span aria-hidden="true">.</span></span> : action && <div className="page-header-action">{action}</div>}</div>
    <div className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  </header>;
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="section-header"><h2>{title}</h2>{action}</div>;
}

export function MetricRow({ items }: { items: { label: string; value: ReactNode; detail?: ReactNode }[] }) {
  return <dl className="metric-row">
    {items.map(item => <div className="metric-row-item" key={item.label}>
      <dt>{item.label}</dt><dd>{item.value}</dd>
      {item.detail && <span className="metric-detail">{item.detail}</span>}
    </div>)}
  </dl>;
}

export function SegmentedControl({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return <div className="segmented-control" role="group" aria-label={label}>
    {options.map(option => <button
      key={option.value}
      type="button"
      aria-pressed={option.value === value}
      className={option.value === value ? 'selected' : ''}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>;
}

export function MenuRow({ title, subtitle, icon, onClick, trailing }: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return <button aria-label={title} className="menu-row" type="button" onClick={onClick}>
    <span className="menu-row-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</span>
    <span className="menu-row-trailing">{trailing ?? <ChevronRight aria-hidden="true" size={18} />}</span>
  </button>;
}

export function BottomNavigation({ items, onSelect }: { onSelect?: (value: string) => void; items: { value: string; label: string; icon: ReactNode }[] }) {
  return <TabsList className="app-nav native-tabbar" aria-label="Main navigation"><div className="app-nav-inner">{items.map(item => <TabsTrigger className="app-nav-item" value={item.value} key={item.value} onClick={() => onSelect?.(item.value)}><span className="app-nav-icon" aria-hidden="true">{item.icon}</span><span className="app-nav-label">{item.label}</span></TabsTrigger>)}</div></TabsList>;
}
