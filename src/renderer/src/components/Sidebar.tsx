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
    padding: collapsed ? '9px 0' : '9px 12px',
    borderRadius: '8px',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: active ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    boxSizing: 'border-box',
    borderLeft: collapsed ? 'none' : `3px solid ${active ? 'var(--primary)' : 'transparent'}`,
    position: 'relative',
  });

  const labelStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'opacity 180ms ease, width 180ms ease',
    marginLeft: collapsed ? 0 : 12,
    display: 'inline-block',
    flex: 1,
    fontSize: '13.5px',
    fontWeight: 500,
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
      style={{
        width: `${width}px`,
        transition: 'width 200ms ease, padding 200ms ease',
        position: 'relative',
        padding: collapsed ? '12px 6px' : '14px 10px 10px 10px',
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
            padding: collapsed ? '2px 0 10px 0' : '2px 6px 10px 6px',
            overflow: 'hidden',
            height: '32px',
            flexShrink: 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
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
              width: 28,
              height: 28,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 6,
              transition: 'background-color 0.15s, color 0.15s',
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
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border-light)', width: '100%', marginBottom: 10 }} />

        {/* Primary Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {TOP_NAV_ITEMS.map(({ id, label, icon: Icon, badge, isConstruction }) => {
            const active = isViewActive(id);
            const badgeVal = badge ? badge(counts) : null;

            return (
              <div
                key={id}
                style={itemStyle(active)}
                onClick={() => onViewChange(id)}
                title={collapsed ? `${label} ${isConstruction ? '(Under Construction)' : ''}` : ''}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 20, color: active ? 'var(--primary)' : 'inherit' }}>
                  <Icon size={18} />
                </div>
                <span style={labelStyle}>{label}</span>

                {/* Construction Pill */}
                {isConstruction && !collapsed && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: 'var(--warning)',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: 4,
                      padding: '1px 5px',
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
                      fontWeight: 700,
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      background: active ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-card-hover)',
                      borderRadius: 10,
                      padding: '1px 7px',
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
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Settings Navigation Item */}
        <div
          style={itemStyle(isViewActive('settings'))}
          onClick={() => onViewChange('settings')}
          title={collapsed ? 'Settings' : ''}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 20, color: isViewActive('settings') ? 'var(--primary)' : 'inherit' }}>
            <Settings size={18} />
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
            padding: collapsed ? '4px 0' : '4px 6px',
            boxSizing: 'border-box',
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
              v1.0.0
            </span>
          )}

          <button
            className={`theme-toggle-pill ${theme}`}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 14,
              padding: '3px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
            }}
          >
            {theme === 'dark' ? <Moon size={13} style={{ color: '#38bdf8' }} /> : <Sun size={13} style={{ color: '#f59e0b' }} />}
            {!collapsed && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};