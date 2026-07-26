import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "OopsSubs — Find & Cancel Forgotten Subscriptions",
  applicationName: "OopsSubs",
  description: "Connect your Gmail, discover every subscription you're paying for, and cancel what you don't need. No bank login. No server. Your data stays on your device.",
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
        <noscript>
          <div style="padding:40px;font-family:sans-serif;max-width:600px;margin:0 auto">
            <h1>OopsSubs</h1>
            <p>OopsSubs is a subscription manager that finds every subscription hidden in your email, reminds you before you're charged, and helps you cancel what you don&apos;t need with step-by-step guides for 79+ services. No server. No database. Your data stays on your device.</p>
          </div>
        </noscript>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
