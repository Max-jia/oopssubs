import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oopssubs.app',
  appName: 'OopsSubs',
  webDir: 'out',
  server: {
    cleartext: true,
    allowNavigation: ['oopssubs.com', 'accounts.google.com'],
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
