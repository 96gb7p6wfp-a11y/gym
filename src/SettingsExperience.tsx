import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MenuRow } from './components/design';
import './settings-experience.css';

export type SettingsSection = 'training' | 'appearance' | 'data' | null;

interface SettingsExperienceProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  training: ReactNode;
  appearance: ReactNode;
  data: ReactNode;
  appInfo?: ReactNode;
  saving?: boolean;
}

const groups = [
  { id: 'training' as const, title: 'Training', description: 'Workout defaults & presentation' },
  { id: 'appearance' as const, title: 'Appearance & Sound', description: 'Your theme and rest alerts' },
  { id: 'data' as const, title: 'Data & Backup', description: 'Backups, updates & support' },
];

/** Presentation only: changing groups never saves or replaces user data. */
export function SettingsExperience({ section, onSectionChange, training, appearance, data, appInfo, saving = false }: SettingsExperienceProps) {
  const prefix = useId();
  const selected = groups.find(group => group.id === section);
  const content = { training, appearance, data };
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const landing = useRef<HTMLElement | null>(null);
  const moved = useRef(false);

  function navigate(next: SettingsSection) {
    moved.current = true;
    onSectionChange(next);
  }

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const target = selected ? headings.current.get(selected.id) : landing.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  return <div className="settings-experience">
    <nav className="settings-experience__groups" aria-label="Settings groups" hidden={!!selected} ref={landing} tabIndex={-1}>
      <p className="settings-experience__intro">Make Setline fit the way you train.</p>
      <div className="menu-group">
        {groups.map(group => <MenuRow key={group.id} title={group.title} subtitle={group.description}
          onClick={() => navigate(group.id)} />)}
      </div>
    </nav>
    {selected && <button type="button" className="text-button settings-experience__back"
      aria-label="All settings" onClick={() => navigate(null)}><ArrowLeft size={18} aria-hidden="true" />All settings</button>}
    {groups.map(group => <section key={group.id} className="settings-experience__panel"
      id={`${prefix}-${group.id}`} hidden={selected?.id !== group.id} aria-labelledby={`${prefix}-${group.id}-title`}>
      <header className="settings-experience__heading">
        <h3 id={`${prefix}-${group.id}-title`} tabIndex={-1} ref={element => {
          if (element) headings.current.set(group.id, element);
          else headings.current.delete(group.id);
        }}>{group.title}</h3>
        {group.id === 'training' && <p>Workout defaults and how much detail you see.</p>}
        {group.id === 'appearance' && <p role="status" aria-live="polite">{saving ? 'Saving changes…' : 'Appearance and sound changes save automatically.'}</p>}
        {group.id === 'data' && <p>Keep a copy of your records and manage this installation.</p>}
      </header>
      <div className="settings-experience__content">{content[group.id]}</div>
      {group.id === 'data' && appInfo && <div className="settings-experience__app-info">{appInfo}</div>}
    </section>)}
  </div>;
}
