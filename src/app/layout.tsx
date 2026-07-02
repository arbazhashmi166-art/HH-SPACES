import type { Metadata, Viewport } from "next";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/display.css";
import "@/styles/globals.css";
import { Providers } from "@/components/Providers";
import { appName, basePath } from "@/lib/env";

export const metadata: Metadata = {
  title: appName,
  description: "Mobile-first contractor business operating system for construction sites, labour, materials, payments, reports, AI, and offline sync.",
  manifest: `${basePath || ""}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appName
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#3b5bff"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
