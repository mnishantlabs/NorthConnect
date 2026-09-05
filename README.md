# NorthConnect

<div align="center">

![NorthConnect Banner](https://img.shields.io/badge/NorthConnect-v1.0.0-3B82F6?style=for-the-badge&logo=discord&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows_10_%2F_11_x64-0078d6?style=for-the-badge&logo=windows)
![Tech](https://img.shields.io/badge/stack-Electron_30_%7C_React_18_%7C_TypeScript-61DAFB?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

**The all-in-one Discord Multi-Account Manager, Voice Streamer, and Soundboard for Windows.**

[🌐 Official Website & Documentation](https://mnishantlabs.github.io/NorthConnect/) &bull; [📦 Download Releases](https://github.com/mnishantlabs/NorthConnect/releases)

</div>

---

## ⚡ Overview

**NorthConnect** is a desktop application built from the ground up using **Electron 30, TypeScript, React 18, and Vite**. It unifies multi-account Discord management with a zero-disk-write audio engine that streams YouTube Music, Spotify tracks, and soundboards directly into Discord voice channels with millisecond precision.

---

## 🚀 Key Features

### 🎧 YouTube & Spotify Voice Streaming Engine
- **Instant Search**: Search millions of songs and artists directly from YouTube Music and Spotify.
- **Direct Link Streaming**: Paste any YouTube, YouTube Music, or Spotify track URL to stream directly into active voice channels.
- **Zero Disk Writes**: Streams decoded raw PCM stereo (48,000 Hz, 16-bit) via memory pipes directly into Discord voice gateways.
- **Compact Grid & Playlist**: View your saved audio and online bookmarks in a sleek, compact card grid layout with duration tags, album art, and local PC preview (headphones).
- **Interactive Soundboard**: Built-in sound presets with category filters and instant Discord VC triggers.
- **Target Routing**: Broadcast music to all connected accounts or route to a specific bot/user token.

### 👥 Multi-Token & Voice Channel Manager
- **Multi-Account Dashboard**: Manage and validate dozens of Discord tokens simultaneously with live avatar rendering, badges, and user tags.
- **One-Click Voice Join**: Join selected tokens or all connected tokens into target voice channels instantly.
- **Live Server Controls**: Inspect server channels and active members, adjust mute/deaf states, watch active screen shares, and safely leave servers with confirmation prompts.
- **Auto-Join & Auto-Reconnect**: Automatically reconnects dropped voice connections with jitter-resilient backoff.

### 🧩 Browser Token Extractor Extension
- Shipped with a companion Chrome extension in xtensions/ for 1-click token extraction and automatic sync with NorthConnect.

### 🛡️ Privacy & Local Security
- All tokens, settings, and playlists are stored exclusively on your local machine with OS-level secure credential storage.
- Zero telemetry, zero external tracking, zero cloud dependencies.

---

## 📦 Downloads

| Edition | File | Description |
| :--- | :--- | :--- |
| **Setup Installer** | NorthConnect-Setup-1.0.0.exe | Guided Windows installer with Start Menu & Desktop shortcuts + uninstaller |
| **Portable Standalone** | NorthConnect-Portable-1.0.0.exe | Single self-contained executable — run instantly anywhere without installation |

👉 [Download the latest release from GitHub Releases](https://github.com/mnishantlabs/NorthConnect/releases)

---

## 🛠️ Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- 
pm or pnpm
- Windows 10/11 64-bit

### Setup & Run
`ash
# Clone the repository
git clone https://github.com/mnishantlabs/NorthConnect.git
cd NorthConnect

# Install dependencies
npm install --legacy-peer-deps

# Start development mode with hot-reload
npm run dev
`

### Packaging Distribution Binaries
`ash
# Build production Setup Installer and Portable Executable
npm run build:win
`
The compiled binaries will be output into the dist-release/ directory.

---

## 🏗️ Architecture

`
NorthConnect/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # App lifecycle & IPC handlers
│   │   ├── preload.ts        # Context bridge & secure API
│   │   ├── voice-audio.ts    # Audio player engine & FFmpeg pipeline
│   │   ├── youtube-service.ts# YouTube & Spotify stream resolver
│   │   └── discord-voice.ts  # Gateway v10 & voice UDP manager
│   ├── renderer/             # React 18 UI
│   │   ├── components/       # Dashboard, Tokens, Connect, PlayView (Player)
│   │   ├── styles/           # Cyber-glassmorphism theme & animations
│   │   └── App.tsx           # App root & navigation
├── extensions/               # Chrome Token Extractor extension
├── docs/                     # GitHub Pages documentation website
└── resources/                # Application icons & native binaries
`

---

## ⚖️ License & Disclaimer

Distributed under the **MIT License**. See LICENSE for details.

*Disclaimer: NorthConnect is an independent developer tool and is not affiliated with, endorsed by, or associated with Discord Inc. Use responsibly in accordance with applicable terms of service.*
