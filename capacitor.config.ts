import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.journeypilot.ai",
  appName: "JourneyPilot AI",
  webDir: ".output/public",
  server: {
    // Allow cleartext traffic during local development if needed.
    cleartext: false,
  },
  plugins: {
    // Route remote server-function requests through Android's native network
    // stack so the packaged app is not constrained by WebView CORS rules.
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    buildOutputDir: "android/app/build/outputs",
  },
  ios: {
    // Web content runs edge to edge; the CSS pads the notch / home indicator
    // with env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#f6f2ea",
  },
};

export default config;
