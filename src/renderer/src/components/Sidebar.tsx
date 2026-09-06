import React, { useState, useRef } from 'react';
import {
  Home,
  KeyRound,
  Radio,
  Gamepad2,
  Settings,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
} from 'lucide-react';

export type ViewId = 'home' | 'tokens' | 'connect' | 'tools' | 'play' | 'settings' | 'accounts' | 'servers' | 'voice' | 'activity';

interface SidebarProps {
  currentView: ViewId;
  onViewChange: (view: ViewId) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  counts: { accounts: number; servers: number; connected: number };
}

interface NavItemConfig {
  id: ViewId;
  label: string;
  icon: React.ComponentType<any>;
  badge?: (c: SidebarProps['counts']) => string | number | null;
  isConstruction?: boolean;
}

const TOP_NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tokens', label: 'Token', icon: KeyRound, badge: (c) => c.accounts },
  { id: 'connect', label: 'Connect', icon: Radio, badge: (c) => (c.connected > 0 ? c.connected : null) },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'play', label: 'Play', icon: Gamepad2 },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, theme, onToggleTheme, counts }) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('northconnect-sidebar-width');
    const parsed = saved ? parseFloat(saved) : NaN;
    if (!isNaN(parsed)) return parsed <= 56 ? 56 : Math.max(190, Math.min(260, parsed));
    return 210;
  });
  const [lastWidth] = useState<number>(() => (width > 56 ? width : 210));
  const widthRef = useRef(width);

  const updateWidth = (w: number) => {
    widthRef.current = w;
    setWidth(w);
  };

  const toggleSidebar = () => {
    if (widthRef.current > 56) {
      updateWidth(56);
      localStorage.setItem('northconnect-sidebar-width', '56');
    } else {
      updateWidth(lastWidth);
      localStorage.setItem('northconnect-sidebar-width', String(lastWidth));
    }
  };

  const collapsed = width <= 56;

  const isViewActive = (id: ViewId) => {
    if (currentView === id) return true;
    if (id === 'tokens' && currentView === 'accounts') return true;
    if (id === 'connect' && (currentView === 'voice' || currentView === 'servers')) return true;
    return false;
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '8px 0' : '8px 10px',
    borderRadius: '6px',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease, color 0.12s ease',
    width: '100%',
    boxSizing: 'border-box',
    borderLeft: collapsed ? 'none' : `3px solid ${active ? 'var(--primary)' : 'transparent'}`,
    position: 'relative',
    fontWeight: active ? 600 : 500,
  });

  const labelStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'opacity 150ms ease, width 150ms ease',
    marginLeft: collapsed ? 0 : 10,
    display: 'inline-block',
    flex: 1,
    fontSize: '13px',
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
      style={{
        width: `${width}px`,
        transition: 'width 180ms cubic-bezier(0.4, 0, 0.2, 1), padding 180ms ease',
        position: 'relative',
        padding: collapsed ? '10px 6px' : '12px 8px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        background: 'var(--bg-titlebar)',
        borderRight: '1px solid var(--border-medium)',
      }}
    >
      {/* Top Header: Section Label & Collapse Button */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '2px 0 8px 0' : '2px 4px 8px 4px',
            overflow: 'hidden',
            height: '28px',
            flexShrink: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
              }}
            >
              Menu
            </span>
          )}

          {/* Top Collapse Button */}
          <button
            onClick={toggleSidebar}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'background-color 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border-light)', width: '100%', marginBottom: 8 }} />

        {/* Primary Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TOP_NAV_ITEMS.map(({ id, label, icon: Icon, badge, isConstruction }) => {
            const active = isViewActive(id);
            const badgeVal = badge ? badge(counts) : null;

            return (
              <div
                key={id}
                style={itemStyle(active)}
                onClick={() => onViewChange(id)}
                title={collapsed ? `${label} ${isConstruction ? '(WIP)' : ''}` : ''}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 18, color: active ? 'var(--primary)' : 'inherit' }}>
                  <Icon size={16} />
                </div>
                <span style={labelStyle}>{label}</span>

                {/* Construction Pill */}
                {isConstruction && !collapsed && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--warning)',
                      background: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      borderRadius: 3,
                      padding: '1px 4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    WIP
                  </span>
                )}

                {/* Count Badge */}
                {badgeVal !== null && !collapsed && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      background: active ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card-hover)',
                      borderRadius: 4,
                      padding: '1px 6px',
                    }}
                  >
                    {badgeVal}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Settings & Footer */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Settings Navigation Item */}
        <div
          style={itemStyle(isViewActive('settings'))}
          onClick={() => onViewChange('settings')}
          title={collapsed ? 'Settings' : ''}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 18, color: isViewActive('settings') ? 'var(--primary)' : 'inherit' }}>
            <Settings size={16} />
          </div>
          <span style={labelStyle}>Settings</span>
        </div>

        <div style={{ height: 1, background: 'var(--border-light)', width: '100%' }} />

        {/* Footer with Version & Theme Switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '2px 0' : '2px 4px',
            boxSizing: 'border-box',
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              v2.0.0
            </span>
          )}

          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 6,
              padding: collapsed ? '4px' : '3px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--text-secondary)',
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
          >
            {theme === 'dark' ? <Moon size={12} style={{ color: '#38bdf8' }} /> : <Sun size={12} style={{ color: '#f59e0b' }} />}
            {!collapsed && (
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};