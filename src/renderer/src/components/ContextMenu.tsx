import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) {
        return; // Allow clicks inside menu to process
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Use mousedown with timeout to avoid catching the opening right-click release
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    let left = x;
    let top = y;
    if (left + rect.width > innerWidth - 8) left = innerWidth - rect.width - 8;
    if (top + rect.height > innerHeight - 8) top = innerHeight - rect.height - 8;
    el.style.left = `${Math.max(4, left)}px`;
    el.style.top = `${Math.max(4, top)}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="custom-context-menu fade-in"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 99999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 10,
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.4)',
        padding: '5px',
        minWidth: 160,
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="context-menu-divider" style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            className="context-menu-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              color: item.danger ? 'var(--danger)' : 'var(--text-primary)',
              opacity: item.disabled ? 0.45 : 1,
              pointerEvents: item.disabled ? 'none' : 'auto',
              cursor: item.disabled ? 'default' : 'pointer',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = item.danger
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'var(--bg-card-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (item.onClick && !item.disabled) {
                item.onClick();
              }
              onClose();
            }}
          >
            {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
          </div>
        )
      )}
    </div>
  );
};