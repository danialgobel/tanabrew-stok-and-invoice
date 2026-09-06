import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.tanabrew.app",
  appName: "Tanabrew",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#00381E",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00381E",
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    allowsLinkPreview: false,
    scrollEnabled: true,
    scheme: "Tanabrew",
  },
};

export default config;
