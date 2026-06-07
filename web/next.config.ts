import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright ต้องรันฝั่ง server (อย่าให้ Next bundle เข้าไป)
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
