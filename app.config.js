export default ({ config }) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return {
    ...config,
    name: isDevelopment ? "Onibus DF Developer" : "Onibus DF",
    slug: "bus-tracker",
    version: "1.0.0",
    orientation: "portrait",
    icon: "src/assets/images/icon.png",
    scheme: "bustracker",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: isDevelopment 
        ? "com.devyat.bustracker.dev" 
        : "com.devyat.bustracker"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "src/assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      usesCleartextTraffic: true,
      package: isDevelopment 
        ? "com.devyat.bustracker.dev" 
        : "com.devyat.bustracker"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "src/assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#000000ff",
          image: "src/assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "This app needs access to location for showing buses and your position on the map."
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      isDevelopment,
      apiBaseUrl: "http://geoserver.semob.df.gov.br/geoserver/semob/ows"
    }
  };
};
