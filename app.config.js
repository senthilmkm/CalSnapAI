module.exports = ({ config }) => {
  const buildNumber = process.env.EAS_BUILD_RUN_NUMBER || config.ios?.buildNumber || "146";

  return {
    ...config,
    name: "CalSnap AI",
    slug: "calsnap-ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "calsnap",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#4F46E5"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.senthilkannan.calsnapai",
      buildNumber: buildNumber,
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription: "CalSnap AI needs camera access to identify food items and estimate calories instantly.",
        NSMicrophoneUsageDescription: "CalSnap AI needs microphone access to record quick voice notes about your meal.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
        backgroundColor: "#ffffff"
      },
      package: "com.senthilkannan.calsnapai",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-camera",
      "expo-image-picker",
      "expo-notifications",
      "expo-apple-authentication"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "60d1b197-be5d-420a-8963-ef7ca0157e9e"
      }
    }
  };
};
