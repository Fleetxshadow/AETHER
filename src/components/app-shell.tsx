'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  Grid2x2,
  Layers3,
  Menu,
  Search,
  Settings2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { TransitionLink as Link } from './route-transition';
import { moduleById, moduleHref, type ModuleId, type Workspace } from '@/lib/modules';
import { useNexus } from '@/lib/store';
import { useDialogFocus } from '@/lib/hooks';
import { spring, useReducedMotion } from '@/lib/motion';
import { playCue } from '@/lib/sound';
import { DemoBadge, Logo, SoundButton } from './ui';
import { ThemeButton } from './theme-provider';

export type ShellRoute = Workspace | 'traffic';
interface NavItem {
  id: ShellRoute;
  name: string;
  label: string;
  href: string;
  icon: LucideIcon;
}
const moduleItem = (id: ModuleId): NavItem => ({
  id,
  name: moduleById[id].name,
  label: moduleById[id].label,
  href: moduleHref(id),
  icon: moduleById[id].icon,
});
// Grouped by the operational loop: observe → understand → locate → validate → respond.
export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operate',
    items: [
      moduleItem('command'),
      {
        id: 'geo',
        name: 'GEO',
        label: 'Spatial review',
        href: '/command/geo',
        icon: Layers3,
      },
      {
        id: 'response',
        name: 'RESPONSE',
        label: 'Human-reviewed intake',
        href: '/command/response',
        icon: Bell,
      },
      {
        id: 'traffic',
        name: 'TRAFFIC',
        label: 'Gurugram investigation',
        href: '/traffic',
        icon: Gauge,
      },
    ],
  },
  { label: 'Observe', items: (['sky', 'flow', 'thermal', 'aqua'] as const).map(moduleItem) },
  { label: 'Assess', items: (['road', 'fire', 'rescue'] as const).map(moduleItem) },
  { label: 'Understand', items: (['core', 'twin'] as const).map(moduleItem) },
];
const utilityItems: NavItem[] = [
  { id: 'reports', name: 'Reports', label: '', href: '/command/reports', icon: FileText },
  {
    id: 'settings',
    name: 'System settings',
    label: '',
    href: '/command/settings',
    icon: Settings2,
  },
];
const allItems = [...navGroups.flatMap((g) => g.items), ...utilityItems];
export function routeGroup(route: ShellRoute) {
  return navGroups.find((g) => g.items.some((i) => i.id === route))?.label ?? 'System';
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  useDialogFocus(true, root, onClose);
  const term = query.trim().toLowerCase();
  const matches = allItems.filter((m) =>
    `${m.name} ${m.label} ${routeGroup(m.id)}`.toLowerCase().includes(term),
  );
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        className="command-palette"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-header">
          <Search size={18} />
          <label className="sr-only" htmlFor="palette-search">
            Search workspaces
          </label>
          <input
            id="palette-search"
            placeholder="Jump to a workspace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-button" onClick={onClose} aria-label="Close command palette">
            <X size={17} />
          </button>
        </div>
        <p className="eyebrow" id="palette-title">
          AETHER WORKSPACES
        </p>
        <div className="palette-results">
          {matches.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.id} href={m.href} onClick={onClose}>
                <Icon size={18} />
                <span>
                  {m.label ? `AETHER ${m.name}` : m.name}{' '}
                  <small>
                    {routeGroup(m.id)}
                    {m.label ? ` · ${m.label}` : ''}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            );
          })}
        </div>
        {!matches.length && <p className="empty-state">No matching workspaces.</p>}
        <div className="palette-footer mono">ESC TO CLOSE · TAB TO NAVIGATE</div>
      </motion.div>
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const reduced = useReducedMotion();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? `${item.name}${item.label ? ` — ${item.label}` : ''}` : undefined}
      className={`os-nav-link${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => {
        onNavigate();
        void playCue('select');
      }}
    >
      {active && (
        <motion.i
          className="os-nav-indicator"
          layoutId="os-nav-indicator"
          transition={reduced ? { duration: 0 } : spring}
        />
      )}
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
      <span className="os-nav-text">
        {item.name}
        {item.label && <small> {item.label}</small>}
      </span>
    </Link>
  );
}

export function AppShell({
  active,
  title,
  search,
  onAlerts,
  children,
  overlay,
  ...data
}: {
  active: ShellRoute;
  title: string;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  onAlerts?: () => void;
  children: ReactNode;
  overlay?: ReactNode;
  'data-workspace'?: string;
  'data-mode'?: string;
  'data-spatial'?: boolean;
}) {
  const sidebarRoot = useRef<HTMLElement>(null);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const status = useNexus((s) => s.demoStatus);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const closePalette = useCallback(() => setPalette(false), []);
  useDialogFocus(drawer, sidebarRoot, closeDrawer);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
  const group = routeGroup(active);
  const dock: NavItem[] = [
    moduleItem('command'),
    navGroups[0].items[1],
    navGroups[0].items[2],
    moduleItem('sky'),
  ];
  return (
    <div
      {...data}
      className={`os-app cinematic-command${collapsed ? ' sidebar-collapsed' : ''}`}
      data-route={active}
    >
      <aside
        ref={sidebarRoot}
        className={`os-sidebar${drawer ? ' open' : ''}`}
        aria-label="Command sidebar"
      >
        <div className="os-brand">
          <Logo compact={collapsed} />
          <button
            className="icon-button os-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Retract sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            className="icon-button os-drawer-close"
            onClick={closeDrawer}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="AETHER modules" className="os-nav">
          {navGroups.map((g) => (
            <div className="os-nav-group" key={g.label}>
              <span className="os-nav-label mono" aria-hidden={collapsed}>
                {g.label}
              </span>
              {g.items.map((item) => (
                <NavLink
                  key={item.id}
                  item={item}
                  active={active === item.id}
                  collapsed={collapsed}
                  onNavigate={closeDrawer}
                />
              ))}
            </div>
          ))}
        </nav>
        <div className="os-nav-utility">
          {utilityItems.map((item) => (
            <NavLink
              key={item.id}
              item={item}
              active={active === item.id}
              collapsed={collapsed}
              onNavigate={closeDrawer}
            />
          ))}
          <Link
            href="/"
            className="os-nav-link"
            title={collapsed ? 'Back to experience' : undefined}
          >
            <ArrowLeft size={17} strokeWidth={1.6} aria-hidden="true" />
            <span className="os-nav-text">Back to experience</span>
          </Link>
          <div className="os-source">
            <DemoBadge offline={status === 'error'} />
            <small>Each record keeps its own source label.</small>
          </div>
        </div>
      </aside>
      <AnimatePresence>
        {drawer && (
          <motion.button
            className="os-backdrop"
            onClick={closeDrawer}
            aria-label="Close navigation overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <div className="os-body">
        <header className="os-topbar">
          <button
            className="icon-button os-drawer-open"
            onClick={() => setDrawer(true)}
            aria-label="Open command navigation"
          >
            <Menu size={20} />
          </button>
          <div className="os-crumb">
            <span className="mono">AETHER</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span className="mono">{group.toUpperCase()}</span>
            <ChevronRight size={12} aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          {search ? (
            <div className={`global-search os-search${searchOpen ? ' search-open' : ''}`}>
              <button
                ref={searchToggle}
                className="icon-button mobile-search-toggle"
                aria-label={searchOpen ? 'Close city search' : 'Search city observations'}
                aria-expanded={searchOpen}
                aria-controls="observation-search"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (!searchOpen) requestAnimationFrame(() => searchInput.current?.focus());
                }}
              >
                {searchOpen ? <X size={17} /> : <Search size={17} />}
              </button>
              <Search size={15} aria-hidden="true" />
              <label className="sr-only" htmlFor="observation-search">
                Search observations and districts
              </label>
              <input
                id="observation-search"
                ref={searchInput}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && searchOpen) {
                    event.stopPropagation();
                    setSearchOpen(false);
                    searchToggle.current?.focus();
                  }
                }}
                type="search"
                placeholder={search.placeholder ?? 'Search observations, districts, IDs…'}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
              />
              <button
                className="shortcut"
                onClick={() => setPalette(true)}
                aria-label="Open command palette"
              >
                Ctrl K
              </button>
            </div>
          ) : (
            <button
              className="os-jump"
              onClick={() => setPalette(true)}
              aria-label="Open command palette"
            >
              <Search size={15} aria-hidden="true" />
              <span>Jump to workspace</span>
              <kbd>Ctrl K</kbd>
            </button>
          )}
          <div className="os-actions">
            <DemoBadge offline={status === 'error'} />
            <ThemeButton />
            <SoundButton />
            {onAlerts && (
              <button className="icon-button" aria-label="View alert timeline" onClick={onAlerts}>
                <Bell size={17} />
              </button>
            )}
          </div>
        </header>
        {children}
      </div>
      <nav className="os-dock" aria-label="Quick navigation">
        {dock.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={active === item.id ? 'active' : ''}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <button onClick={() => setDrawer(true)} aria-label="All AETHER workspaces">
          <Grid2x2 size={18} aria-hidden="true" />
          <span>All</span>
        </button>
      </nav>
      {overlay}
      <AnimatePresence>{palette && <CommandPalette onClose={closePalette} />}</AnimatePresence>
    </div>
  );
}
