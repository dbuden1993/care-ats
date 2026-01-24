import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareRecruit ATS | Healthcare Recruitment Platform",
  description: "AI-powered recruitment platform for healthcare staffing. Manage candidates, track calls, and automate outreach with intelligent SMS and WhatsApp campaigns.",
  keywords: ["healthcare recruitment", "ATS", "care staffing", "recruitment software", "candidate tracking"],
  authors: [{ name: "CareRecruit" }],
  openGraph: {
    title: "CareRecruit ATS",
    description: "AI-powered healthcare recruitment platform",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
