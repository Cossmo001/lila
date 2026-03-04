import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lila.app',
  appName: 'Kadi',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      backgroundColor: '#0a1219',
      style: 'dark'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a1219',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
