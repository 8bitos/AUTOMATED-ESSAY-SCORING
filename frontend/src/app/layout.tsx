import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // Import AuthProvider
import { ThemeProvider } from "@/context/ThemeContext";
import { getSiteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SAGE | Smart Automated Grading Engine",
    template: "%s | SAGE",
  },
  description: "Platform LMS untuk penilaian esai otomatis, rubrik transparan, dan feedback akademik terstruktur.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "SAGE",
    title: "SAGE | Smart Automated Grading Engine",
    description: "Platform LMS untuk penilaian esai otomatis, rubrik transparan, dan feedback akademik terstruktur.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SAGE | Smart Automated Grading Engine",
    description: "Platform LMS untuk penilaian esai otomatis, rubrik transparan, dan feedback akademik terstruktur.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Suspense fallback={null}>
            <AuthProvider>{children}</AuthProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
