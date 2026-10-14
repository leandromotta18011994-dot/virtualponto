import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.virtualponto.bancodehoras",
  appName: "Banco de Horas",
  webDir: "dist",
  server: {
    // O APK abre o app publicado (WebView), então login e banco de dados funcionam igual ao site.
    url: "https://virtualponto.lovable.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0F172A",
  },
};

export default config;
