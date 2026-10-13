import os from "os";
import type { NextConfig } from "next";

function lanHosts() {
  const hosts = new Set<string>();
  for (const adapters of Object.values(os.networkInterfaces())) {
    for (const adapter of adapters ?? []) {
      if (adapter.family === "IPv4" && !adapter.internal) {
        hosts.add(adapter.address);
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  // Colleagues open the app by this PC's LAN address. Dev mode blocks
  // those requests unless the address is listed here.
  allowedDevOrigins: lanHosts(),
};

export default nextConfig;
