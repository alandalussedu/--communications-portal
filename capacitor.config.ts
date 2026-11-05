import type { CapacitorConfig } from "@capacitor/cli"

/**
 * The iOS app wraps the same build as the website (dist/). Data comes from
 * Supabase exactly as on the site; nothing secret lives in the app.
 */
const config: CapacitorConfig = {
  appId: "sa.edu.andalus.portal",
  appName: "بوابة التواصل",
  webDir: "dist",
  ios: {
    // the page already pads for the notch and home bar (safe-area insets)
    contentInset: "never",
    backgroundColor: "#212178",
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#212178",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#212178",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
