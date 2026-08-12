module.exports = ({ config }) => {
  const buildNumber = process.env.EAS_BUILD_RUN_NUMBER || "142";

  return {
    ...config,
    name: "CalSnap AI",
    slug: "calsnap-ai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "calsnapai",
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
      infoPlist: {
        NSCameraUsageDescription: "CalSnap AI needs camera access to identify food items and estimate calories instantly.",
        NSMicrophoneUsageDescription: "CalSnap AI needs microphone access to record quick voice notes about your meal."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
        backgroundColor: "#ffffff"
      },
      package: "com.senthilkannan.calsnapai"
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      "expo-image",
      "expo-image-picker",
      "expo-notifications",
      "expo-sharing"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      ...config.extra,
    }
  };
};
