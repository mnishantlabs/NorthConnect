import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchable = false,
  disabled = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFilterQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter((opt) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return opt.label.toLowerCase().includes(q) || (opt.sublabel && opt.sublabel.toLowerCase().includes(q));
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          background: 'var(--bg-card)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
          borderRadius: 8,
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 2px var(--primary-glow)' : 'none',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxSizing: 'border-box',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, textAlign: 'left' }}>
          {selectedOption?.icon && <span style={{ flexShrink: 0 }}>{selectedOption.icon}</span>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {selectedOption.sublabel}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className="fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 280,
          }}
        >
          {/* Optional Search Filter in dropdown */}
          {(searchable || options.length > 6) && (
            <div
              style={{
                padding: '8px 10px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-main)',
              }}
            >
              <Search size={13} style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter options..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}

          {/* Options List */}
          <div style={{ overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setFilterQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 500,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
