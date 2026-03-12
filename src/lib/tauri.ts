/**
 * Tauri API Utilities
 * 
 * Provides native functionality when running in Tauri desktop app
 * Falls back gracefully when running in browser
 * 
 * Optimized for Tauri v2 and low memory footprint overlay mode
 */

// Check if running in Tauri
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI__' in window || (window as any).__TAURI_INTERNALS__ !== undefined);
};

// Lazy import Tauri APIs to avoid errors in browser
const getTauriWindow = async () => {
  if (!isTauri()) return null;
  try {
    // @ts-ignore - Tauri v2 submodule path
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    return getCurrentWebviewWindow();
  } catch {
    return null;
  }
};

const getTauriNotification = async () => {
  if (!isTauri()) return null;
  try {
    return await import('@tauri-apps/plugin-notification');
  } catch {
    return null;
  }
};

const getTauriShell = async () => {
  if (!isTauri()) return null;
  try {
    return await import('@tauri-apps/plugin-shell');
  } catch {
    return null;
  }
};

const getTauriFs = async () => {
  if (!isTauri()) return null;
  try {
    return await import('@tauri-apps/plugin-fs');
  } catch {
    return null;
  }
};

// Window controls
export const setAlwaysOnTop = async (onTop: boolean): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  await appWindow.setAlwaysOnTop(onTop);
};

export const minimizeWindow = async (): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  await appWindow.minimize();
};

export const maximizeWindow = async (): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  await appWindow.toggleMaximize();
};

export const closeWindow = async (): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  await appWindow.close();
};

export const setWindowSize = async (width: number, height: number): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  // @ts-ignore - LogicalSize available on window module
  const { LogicalSize } = await import('@tauri-apps/api/dpi');
  await appWindow.setSize(new LogicalSize(width, height));
};

export const setWindowPosition = async (x: number, y: number): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  // @ts-ignore - LogicalPosition available on window module
  const { LogicalPosition } = await import('@tauri-apps/api/dpi');
  await appWindow.setPosition(new LogicalPosition(x, y));
};

export const startDragging = async (): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  await appWindow.startDragging();
};

// Native notifications (more efficient than browser API)
export const sendNativeNotification = async (
  title: string,
  body: string
): Promise<void> => {
  const notificationPlugin = await getTauriNotification();

  if (!notificationPlugin) {
    // Fallback to browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }

  const { sendNotification, isPermissionGranted, requestPermission } = notificationPlugin;

  let permitted = await isPermissionGranted();
  if (!permitted) {
    const permission = await requestPermission();
    permitted = permission === 'granted';
  }

  if (permitted) {
    sendNotification({ title, body });
  }
};

// Open external URL in default browser
export const openExternal = async (url: string): Promise<void> => {
  const shellPlugin = await getTauriShell();

  if (!shellPlugin) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await shellPlugin.open(url);
};

// File system operations with fallback to localStorage
export const saveToAppData = async (
  filename: string,
  content: string
): Promise<void> => {
  const fsPlugin = await getTauriFs();

  if (!fsPlugin) {
    localStorage.setItem(`aura-${filename}`, content);
    return;
  }

  const { mkdir, writeTextFile, BaseDirectory } = fsPlugin;

  // Ensure directory exists
  try {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // Directory might already exist
  }

  await writeTextFile(filename, content, { baseDir: BaseDirectory.AppData });
};

export const loadFromAppData = async (filename: string): Promise<string | null> => {
  const fsPlugin = await getTauriFs();

  if (!fsPlugin) {
    return localStorage.getItem(`aura-${filename}`);
  }

  const { readTextFile, BaseDirectory } = fsPlugin;
  try {
    return await readTextFile(filename, { baseDir: BaseDirectory.AppData });
  } catch {
    return null;
  }
};

// Overlay mode presets
export const setOverlayMode = async (enabled: boolean): Promise<void> => {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  
  if (enabled) {
    // Compact overlay mode for gaming
    await appWindow.setAlwaysOnTop(true);
    await appWindow.setDecorations(false);
    await setWindowSize(400, 300);
  } else {
    // Full window mode
    await appWindow.setAlwaysOnTop(false);
    await appWindow.setDecorations(true);
    await setWindowSize(1200, 800);
    await appWindow.center();
  }
};
