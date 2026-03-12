import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { isTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';

export function useAutoUpdater() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const checkForUpdates = async (manual = false) => {
    if (!isTauri()) {
      if (manual) {
        toast.error('Browser Not Supported', {
          description: 'Auto-updates are only available in the Aura Desktop App.',
        });
      }
      return;
    }

    try {
      setIsChecking(true);
      const update = await check();
      
      if (update) {
        setUpdateAvailable(true);
        console.log(`Update available: ${update.version}`);
        
        toast('Update Available!', {
          description: `Aura VTC Hub v${update.version} is ready to install.`,
          action: {
            label: 'Update Now',
            onClick: async () => {
              let downloaded = 0;
              let contentLength = 0;
              
              await update.downloadAndInstall((event) => {
                switch (event.event) {
                  case 'Started':
                    contentLength = event.data.contentLength || 0;
                    toast.loading(`Downloading update... 0%`);
                    break;
                  case 'Progress':
                    downloaded += event.data.chunkLength;
                    if (contentLength > 0) {
                      const nextProgress = Math.round((downloaded / contentLength) * 100);
                      setDownloadProgress(nextProgress);
                    }
                    break;
                  case 'Finished':
                    toast.success('Update installed! Restarting...');
                    break;
                }
              });
            },
          },
          duration: 10000,
        });
      } else if (manual) {
        toast.success('App Up-to-Date', {
          description: 'You are running the latest version of Aura VTC Hub.',
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      if (manual) {
        toast.error('Update Check Failed', {
          description: 'Could not connect to the update server.',
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Delay check slightly so app loads first
    const timer = setTimeout(() => checkForUpdates(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return { isChecking, updateAvailable, downloadProgress, checkForUpdates };
}
