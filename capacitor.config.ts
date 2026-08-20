import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "art.schlag.iamfit",
  appName: "I am fit",
  webDir: "out",
  server: {
    // For store builds, point this at the hosted Next.js app
    // so API routes (Import) remain available.
    // androidScheme: "https",
  },
};

export default config;
