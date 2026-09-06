import React, { useState, useEffect, useRef } from 'react';
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
import { AppIcon } from './AppIcon';

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
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        if (parsed <= 56) return 56;
        return Math.max(180, Math.min(280, parsed));
      }
    }
    return 220; // Default width
  });

  const [lastWidth, setLastWidth] = useState<number>(() => {
    const saved = localStorage.getItem('northconnect-sidebar-width');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 180 && parsed <= 280) return parsed;
    }
    return 220;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  const widthRef = useRef<number>(width);
  const releaseXRef = useRef<number>(width);

  const updateWidth = (newWidth: number) => {
    widthRef.current = newWidth;
    setWidth(newWidth);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setTransitionEnabled(false);
    releaseXRef.current = widthRef.current;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const clientX = e.clientX;
      const minWidth = 180;
      const maxWidth = 280;

      releaseXRef.current = clientX;
      const currentW = widthRef.current;

      if (clientX < minWidth) {
        if (currentW !== 56) {
          setTransitionEnabled(true);
          updateWidth(56);
          localStorage.setItem('northconnect-sidebar-width', '56');
        }
      } else {
        const targetWidth = Math.min(maxWidth, clientX);
        if (currentW === 56) {
          setTransitionEnabled(true);
          updateWidth(targetWidth);
          setLastWidth(targetWidth);
          localStorage.setItem('northconnect-sidebar-width', String(targetWidth));
        } else {
          setTransitionEnabled(false);
          updateWidth(targetWidth);
          setLastWidth(targetWidth);
          localStorage.setItem('northconnect-sidebar-width', String(targetWidth));
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setTransitionEnabled(true);
      const finalX = releaseXRef.current;
      if (finalX < 180) {
        updateWidth(56);
        localStorage.setItem('northconnect-sidebar-width', '56');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTransitionEnabled(true);
    if (widthRef.current > 56) {
      updateWidth(56);
      localStorage.setItem('northconnect-sidebar-width', '56');
    } else {
      updateWidth(lastWidth);
      localStorage.setItem('northconnect-sidebar-width', String(lastWidth));
    }
  };

  const isViewActive = (id: ViewId) => {
    if (currentView === id) return true;
    if (id === 'tokens' && currentView === 'accounts') return true;
    if (id === 'connect' && (currentView === 'voice' || currentView === 'servers')) return true;
    return false;
  };

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: width > 56 ? 'flex-start' : 'center',
    padding: width > 56 ? '10px 12px' : '10px 0',
    borderRadius: '6px',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    boxSizing: 'border-box',
    borderLeft: width > 56 ? `2px solid ${isActive ? 'var(--primary)' : 'transparent'}` : 'none',
    borderTopLeftRadius: isActive && width > 56 ? '2px' : '6px',
    borderBottomLeftRadius: isActive && width > 56 ? '2px' : '6px',
    fontWeight: isActive ? 600 : 500,
    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.04)' : 'none',
  });

  const labelStyle: React.CSSProperties = {
    opacity: width > 56 ? 1 : 0,
    width: width > 56 ? 'auto' : '0px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'opacity 200ms ease, width 200ms ease',
    marginLeft: width > 56 ? '12px' : '0px',
    display: 'inline-block',
    flex: 1,
    fontSize: '13px',
  };

  return (
    <aside
      className={`sidebar ${width > 56 ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
      style={{
        width: `${width}px`,
        transition: transitionEnabled ? 'width 200ms ease, padding 200ms ease' : 'none',
        position: 'relative',
        padding: width > 56 ? '16px 8px' : '16px 4px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        background: 'var(--bg-titlebar)',
        borderRight: '1px solid var(--border-light)',
      }}
    >
      {/* Drag Resize Handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 1000,
          backgroundColor: isHandleHovered || isDragging ? 'var(--primary)' : 'transparent',
          opacity: isHandleHovered || isDragging ? 0.6 : 0,
          transition: 'background-color 0.2s ease, opacity 0.2s ease',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHandleHovered(true)}
        onMouseLeave={() => setIsHandleHovered(false)}
      />

      {/* Header containing App Icon and App Name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: width > 56 ? 'flex-start' : 'center',
          gap: width > 56 ? '12px' : '0px',
          padding: width > 56 ? '0 10px' : '0',
          overflow: 'hidden',
          height: '48px',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
          width: '100%',
          cursor: 'pointer',
        } as React.CSSProperties}
        onClick={() => onViewChange('home')}
      >
        <AppIcon size={26} />
        <span
          className="logo-text"
          style={{
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            textTransform: 'none',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            opacity: width > 56 ? 1 : 0,
            width: width > 56 ? 'auto' : '0px',
            overflow: 'hidden',
            transition: 'opacity 200ms ease, width 200ms ease',
            display: 'inline-block',
          }}
        >
          NorthConnect
        </span>
      </div>
      <div style={{ height: 1, background: 'var(--sidebar-footer-border)', margin: '4px 0 10px 0', width: '100%' }} />

      {/* Primary Navigation Menu */}
      <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {TOP_NAV_ITEMS.map(({ id, label, icon: Icon, badge, isConstruction }) => {
            const active = isViewActive(id);
            const badgeVal = badge ? badge(counts) : null;

            return (
              <div
                key={id}
                style={itemStyle(active)}
                onClick={() => onViewChange(id)}
                title={width <= 56 ? `${label} ${isConstruction ? '(WIP)' : ''}` : ''}
              >
                <div
                  className="sidebar-icon-wrapper"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '20px',
                    color: active ? 'var(--primary)' : 'inherit',
                  }}
                >
                  <Icon size={18} />
                </div>
                <span style={labelStyle} className="sidebar-label">{label}</span>

                {/* Construction Pill */}
                {isConstruction && width > 56 && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: 'var(--warning)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
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
                {badgeVal !== null && width > 56 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? 'var(--primary)' : 'var(--text-muted)',
                      background: active ? 'rgba(88, 101, 242, 0.12)' : 'var(--bg-card-hover)',
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

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom Section: Collapse Toggle, Settings & Theme Switcher */}
      <div className="sidebar-bottom" style={{ width: '100%' }}>
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          title={width <= 56 ? 'Expand' : 'Collapse'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: width > 56 ? 'flex-start' : 'center',
            padding: width > 56 ? '8px 12px' : '8px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '6px',
            width: width > 56 ? '100%' : '36px',
            margin: width > 56 ? '0' : '0 auto',
            gap: width > 56 ? '12px' : '0px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          className="sidebar-toggle-btn"
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '20px' }}>
            {width > 56 ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </div>
          <span style={labelStyle} className="sidebar-label">Collapse</span>
        </button>

        <div style={{ height: 1, background: 'var(--sidebar-footer-border)', margin: '6px 0', width: '100%' }} />

        {/* Settings Navigation Item */}
        <div
          style={itemStyle(isViewActive('settings'))}
          onClick={() => onViewChange('settings')}
          title={width <= 56 ? 'Settings' : ''}
        >
          <div
            className="sidebar-icon-wrapper"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '20px',
              color: isViewActive('settings') ? 'var(--primary)' : 'inherit',
            }}
          >
            <Settings size={18} />
          </div>
          <span style={labelStyle} className="sidebar-label">Settings</span>
        </div>

        {/* Sidebar Footer containing Version & Sliding Pill Theme Switcher */}
        {width > 56 ? (
          <div
            className="sidebar-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--sidebar-footer-border)',
              padding: '10px 8px 2px 8px',
              marginTop: '6px',
              boxSizing: 'border-box',
            }}
          >
            <span className="sidebar-label sidebar-footer-version" style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              v2.0.0
            </span>
            <button
              className={`theme-toggle-pill ${theme}`}
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div className="theme-toggle-circle">
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
              </div>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 2px 0',
              borderTop: '1px solid var(--sidebar-footer-border)',
              marginTop: '6px',
            }}
          >
            <button
              className={`theme-toggle-pill ${theme}`}
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div className="theme-toggle-circle">
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};