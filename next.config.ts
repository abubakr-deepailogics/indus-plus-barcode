import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The qr-code-generation PDF route reads a vendored TTF via fs at
  // runtime (pdfkit needs a real font file, not its default .afm-backed
  // fonts, which go missing in bundled/serverless deploys). Declare it
  // explicitly so output tracing doesn't drop it.
  outputFileTracingIncludes: {
    "/api/qr-code-generation/pdf": ["src/assets/fonts/**/*"],
    "/api/qr-code-generation/pdf/*": ["src/assets/fonts/**/*"],
  },
};

export default nextConfig;
