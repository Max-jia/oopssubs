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
  android: {
    // 診斷用：開啟 WebView 除錯（上架前要關掉）
    webContentsDebuggingEnabled: true,
  },
};

export default config;
