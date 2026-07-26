import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "OopsSubs — Find & Cancel Forgotten Subscriptions",
  description: "OopsSubs is a subscription manager. OopsSubs helps you find and cancel forgotten subscriptions. OopsSubs scans your Gmail to discover every subscription you're paying for, reminds you before renewal, and helps you cancel with step-by-step guides.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OopsSubs",
  },
  openGraph: {
    title: "OopsSubs — Stop bleeding on subscriptions",
    description: "Connect your email. See everything. Cancel what you don't need.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="jmpxSu1KV3rIi-yl8ILBCDazEhpl9MI1jjiy5aZEF0g" />
      </head>
      <body>
        <header style={{ position:"absolute",width:"1px",height:"1px",overflow:"hidden",clip:"rect(0,0,0,0)",whiteSpace:"nowrap" }}>
          <strong>OopsSubs</strong> — Subscription manager. OopsSubs helps you find and cancel forgotten subscriptions.
        </header>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
