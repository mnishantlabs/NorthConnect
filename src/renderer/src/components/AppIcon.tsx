import React from 'react';

interface AppIconProps {
  size?: number;
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ size = 26, className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="nc-bg-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="nc-inner-grad" x1="10" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.8" />
        </linearGradient>
        <filter id="nc-drop" x="0" y="2" width="40" height="38" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#1d4ed8" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Rounded Squircle Container with drop shadow */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="url(#nc-bg-grad)"
        filter="url(#nc-drop)"
      />

      {/* Subtle border highlight */}
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="9.5"
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth="1"
      />

      {/* Discord Bot Silhouette & Token Key */}
      <g transform="translate(7.5, 9)">
        {/* Discord Controller Head Base */}
        <path
          d="M21.2 2.2C19.6 1.4 17.8 0.9 16 0.7C15.8 1.1 15.6 1.6 15.4 2.1C13.4 1.8 11.6 1.8 9.6 2.1C9.4 1.6 9.2 1.1 9 0.7C7.2 0.9 5.4 1.4 3.8 2.2C0.6 7.0 -0.2 11.6 0.1 16.2C2.3 17.8 4.4 18.8 6.5 19.4C7.0 18.7 7.5 18.0 7.9 17.2C7.1 16.9 6.4 16.5 5.8 16.0C6.0 15.9 6.1 15.7 6.3 15.6C10.3 17.5 14.7 17.5 18.7 15.6C18.9 15.7 19.0 15.9 19.2 16.0C18.6 16.5 17.8 16.9 17.1 17.2C17.5 18.0 18.0 18.7 18.5 19.4C20.6 18.8 22.7 17.8 24.9 16.2C25.3 10.9 24.0 6.4 21.2 2.2Z"
          fill="url(#nc-inner-grad)"
        />

        {/* Left Eyes & Right Eyes (Token Connect Ports) */}
        <circle cx="7.2" cy="9.2" r="2.2" fill="#1e3a8a" />
        <circle cx="17.8" cy="9.2" r="2.2" fill="#1e3a8a" />

        {/* Central Key / Lightning Node in Controller */}
        <path
          d="M13.2 5.5L11.5 9.5H13.8L12.2 13.8L15.2 9.5H13.0L14.2 5.5H13.2Z"
          fill="#3b82f6"
        />
      </g>
    </svg>
  );
};
