import type { CapacitorConfig } from "@capacitor/cli";

const LIVE_URL = "https://i-am-super-fit.vercel.app";

const config: CapacitorConfig = {
  appId: "art.schlag.iamfit",
  appName: "I am fit",
  webDir: "out",
  server: {
    // Native shells load the hosted Next.js app so Import-API and Auth stay on Vercel.
    url: LIVE_URL,
    androidScheme: "https",
  },
};

export default config;
