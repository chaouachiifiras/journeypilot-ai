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
};

export default config;
