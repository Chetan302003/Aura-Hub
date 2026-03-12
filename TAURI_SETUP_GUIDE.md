# 🚛 Aura VTC Hub - Tauri Desktop App Setup Guide

## Overview

This guide walks you through converting the Aura VTC Hub web app into a native desktop application using **Tauri**. The app is optimized for:

- **~40MB RAM footprint** (vs ~400MB for Electron)
- **Native WebView2 engine** on Windows
- **Always-on-top overlay** for ETS2/ATS gaming
- **Minimal CPU usage** during gameplay

---

## Prerequisites

### All Platforms
- [Node.js 18+](https://nodejs.org/)
- [Rust](https://rustup.rs/) - Install via rustup
- Git

### Windows
```powershell
# Install Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools
# Select "Desktop development with C++" workload

# Install WebView2 (usually pre-installed on Windows 10/11)
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### Linux (Fedora)
```bash
sudo dnf install webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    libappindicator-gtk3 \
    librsvg2-devel
```

---

## Step 1: Clone & Setup Project

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/aura-vtc-hub.git
cd aura-vtc-hub

# Install dependencies
npm install

# Install Tauri CLI
npm install -D @tauri-apps/cli@latest
```

---

## Step 2: Initialize Tauri

```bash
# Initialize Tauri in your project
npx tauri init
```

When prompted:
- **App name**: `Aura VTC Hub`
- **Window title**: `Aura VTC Hub`
- **Web assets location**: `../dist`
- **Dev server URL**: `http://localhost:5173`
- **Dev command**: `npm run dev`
- **Build command**: `npm run build`

---

## Step 3: Configure Tauri

Replace `src-tauri/tauri.conf.json` with:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Aura VTC Hub",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "window": {
        "all": true,
        "setAlwaysOnTop": true,
        "setDecorations": true,
        "setSize": true,
        "setPosition": true,
        "minimize": true,
        "maximize": true,
        "close": true,
        "startDragging": true
      },
      "notification": {
        "all": true
      },
      "shell": {
        "open": true
      },
      "fs": {
        "readFile": true,
        "writeFile": true,
        "scope": ["$APPDATA/*", "$RESOURCE/*"]
      },
      "path": {
        "all": true
      }
    },
    "bundle": {
      "active": true,
      "category": "Game",
      "copyright": "© 2024 Aura VTC",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.auravtc.hub",
      "longDescription": "Fleet management hub for Euro Truck Simulator 2 VTC",
      "shortDescription": "Aura VTC Hub",
      "targets": "all",
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    },
    "security": {
      "csp": "default-src 'self'; img-src 'self' https: data:; connect-src 'self' https://*.supabase.co https://api.truckersmp.com wss://*.supabase.co; style-src 'self' 'unsafe-inline'; font-src 'self' data:"
    },
    "windows": [
      {
        "title": "Aura VTC Hub",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "skipTaskbar": false,
        "center": true
      }
    ]
  }
}
```

---

## Step 4: Add Tauri APIs to Frontend

Install Tauri JavaScript APIs:

```bash
npm install @tauri-apps/api
```

Create `src/lib/tauri.ts`:

```typescript
/**
 * Tauri API Utilities
 * 
 * Provides native functionality when running in Tauri
 * Falls back gracefully in browser
 */

// Check if running in Tauri
export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Window controls
export const setAlwaysOnTop = async (onTop: boolean) => {
  if (!isTauri()) return;
  const { appWindow } = await import('@tauri-apps/api/window');
  await appWindow.setAlwaysOnTop(onTop);
};

export const minimizeWindow = async () => {
  if (!isTauri()) return;
  const { appWindow } = await import('@tauri-apps/api/window');
  await appWindow.minimize();
};

export const closeWindow = async () => {
  if (!isTauri()) return;
  const { appWindow } = await import('@tauri-apps/api/window');
  await appWindow.close();
};

// Native notifications
export const sendNativeNotification = async (title: string, body: string) => {
  if (!isTauri()) {
    // Fallback to browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }
  
  const { sendNotification, isPermissionGranted, requestPermission } = 
    await import('@tauri-apps/api/notification');
  
  let permitted = await isPermissionGranted();
  if (!permitted) {
    const permission = await requestPermission();
    permitted = permission === 'granted';
  }
  
  if (permitted) {
    sendNotification({ title, body });
  }
};

// File system operations
export const saveToFile = async (filename: string, content: string) => {
  if (!isTauri()) {
    localStorage.setItem(filename, content);
    return;
  }
  
  const { writeTextFile, BaseDirectory } = await import('@tauri-apps/api/fs');
  await writeTextFile(filename, content, { dir: BaseDirectory.AppData });
};

export const loadFromFile = async (filename: string): Promise<string | null> => {
  if (!isTauri()) {
    return localStorage.getItem(filename);
  }
  
  const { readTextFile, BaseDirectory } = await import('@tauri-apps/api/fs');
  try {
    return await readTextFile(filename, { dir: BaseDirectory.AppData });
  } catch {
    return null;
  }
};
```

---

## Step 5: Create App Icons

Create icons directory and add app icons:

```bash
mkdir -p src-tauri/icons
```

You'll need these icon files in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png` (256x256)
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Use an icon generator like [tauri-icon](https://github.com/nicholasio/tauri-icon) or create manually.

---

## Step 6: Development

```bash
# Start Tauri in development mode
npm run tauri dev
```

This will:
1. Start the Vite dev server
2. Launch the Tauri window
3. Enable hot-reload

---

## Step 7: Build for Production

### Windows (.exe + .msi)
```bash
npm run tauri build
```
Output: `src-tauri/target/release/bundle/`

### macOS (.app + .dmg)
```bash
npm run tauri build
```
Output: `src-tauri/target/release/bundle/`

### Linux (.deb + .AppImage)
```bash
npm run tauri build
```
Output: `src-tauri/target/release/bundle/`

---

## Step 8: Always-On-Top Overlay Feature

Add to your Settings page:

```tsx
import { isTauri, setAlwaysOnTop } from '@/lib/tauri';
import { useUIStore } from '@/stores/appStore';

// In your Settings component:
const { alwaysOnTop, setAlwaysOnTop: setStoreAlwaysOnTop } = useUIStore();

const handleToggleOverlay = async (enabled: boolean) => {
  setStoreAlwaysOnTop(enabled);
  await setAlwaysOnTop(enabled);
};

// Add toggle switch in settings UI
{isTauri() && (
  <div className="flex items-center justify-between">
    <Label>Always on Top (Overlay Mode)</Label>
    <Switch 
      checked={alwaysOnTop} 
      onCheckedChange={handleToggleOverlay}
    />
  </div>
)}
```

---

## Performance Optimizations

The app is already optimized with:

1. **Zustand** - Lightweight state (~1KB) vs Redux (~10KB)
2. **React Query** - Efficient data caching & background updates
3. **Virtual Lists** - Only renders visible items
4. **CSS Transforms** - GPU-accelerated animations
5. **WebP/SVG assets** - Smaller file sizes
6. **Service Worker** - Offline caching

### Memory Usage Comparison

| App | RAM Usage |
|-----|-----------|
| Aura VTC Hub (Tauri) | ~40-60 MB |
| Discord (Electron) | ~300-500 MB |
| Spotify (Electron) | ~200-400 MB |

---

## Troubleshooting

### Windows: WebView2 not found
```powershell
# Install WebView2 Runtime
winget install Microsoft.EdgeWebView2Runtime
```

### Linux: WebKit not found
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk4.0-devel
```

### Build fails with Rust errors
```bash
# Update Rust
rustup update stable
```

### App crashes on startup
Check the console for CSP errors and update `tauri.conf.json` security settings.

---

## Distribution

### Windows
- Sign with code signing certificate for SmartScreen bypass
- Use `.msi` for enterprise deployment

### macOS
- Notarize with Apple Developer account
- Create `.dmg` for easy distribution

### Linux
- `.AppImage` works on most distros
- `.deb` for Debian-based systems

---

## Support

For issues specific to this app:
- Check browser console for errors
- Verify Supabase connection in `.env`
- Test API endpoints in browser first

For Tauri issues:
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri Discord](https://discord.gg/tauri)

---

**Happy Trucking! 🚛**
