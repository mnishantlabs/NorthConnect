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
        {/* Sleek Discord Blurple & Electric Indigo Gradient */}
        <linearGradient id="nc-bg-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#5865F2" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>

        {/* Soft Radial Ambient Highlight */}
        <radialGradient id="nc-radial-light" cx="20%" cy="15%" r="85%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Modern Crisp Foreground Gradient */}
        <linearGradient id="nc-symbol-grad" x1="12" y1="10" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>

        {/* Deep Smooth Drop Shadow */}
        <filter id="nc-shadow" x="0" y="2" width="40" height="38" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#3730A3" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Main Squircle Container */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="url(#nc-bg-grad)"
        filter="url(#nc-shadow)"
      />

      {/* Gloss / Light reflection overlay */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="url(#nc-radial-light)"
      />

      {/* Subtle crisp inner border */}
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="9.5"
        stroke="rgba(255, 255, 255, 0.28)"
        strokeWidth="1"
      />

      {/* Futuristic Hybrid Node / Compass / Controller Symbol */}
      <g transform="translate(8, 8)">
        {/* Dynamic connection wings / controller base */}
        <path
          d="M20.5 2.1C18.9 1.4 17.2 0.9 15.4 0.7C15.2 1.1 15.0 1.6 14.8 2.0C12.9 1.7 11.1 1.7 9.2 2.0C9.0 1.6 8.8 1.1 8.6 0.7C6.8 0.9 5.1 1.4 3.5 2.1C0.4 6.8 -0.3 11.3 0.1 15.7C2.2 17.3 4.3 18.2 6.3 18.8C6.8 18.1 7.3 17.4 7.7 16.7C7.0 16.4 6.3 16.0 5.6 15.5C5.8 15.4 6.0 15.2 6.1 15.1C10.0 16.9 14.0 16.9 17.9 15.1C18.0 15.2 18.2 15.4 18.4 15.5C17.7 16.0 17.0 16.4 16.3 16.7C16.7 17.4 17.2 18.1 17.7 18.8C19.7 18.2 21.8 17.3 23.9 15.7C24.4 10.5 23.1 6.1 20.5 2.1Z"
          fill="url(#nc-symbol-grad)"
        />

        {/* Left Connection Eye */}
        <circle cx="7" cy="8.8" r="2.2" fill="#312E81" />
        <circle cx="7" cy="8.8" r="1.1" fill="#818CF8" />

        {/* Right Connection Eye */}
        <circle cx="17" cy="8.8" r="2.2" fill="#312E81" />
        <circle cx="17" cy="8.8" r="1.1" fill="#818CF8" />

        {/* Central North Star / Nexus Pulse */}
        <path
          d="M12 4.2L12.9 7.1L15.8 8.0L12.9 8.9L12 11.8L11.1 8.9L8.2 8.0L11.1 7.1L12 4.2Z"
          fill="#5865F2"
        />
      </g>
    </svg>
  );
};
