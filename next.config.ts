import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // PDFKit resolves its AFM/ICC runtime assets relative to its package path.
  // Keeping it external prevents Turbopack from replacing that path with /ROOT.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
