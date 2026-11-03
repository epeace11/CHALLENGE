import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NoZoom } from '@/components/no-zoom';
import { themeScript } from '@/components/theme-toggle';
export const metadata: Metadata = {
  title: 'The Challenge',
  description:
    'A challenge for two: check in every day, review each other, and settle up with a gift.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: 'The Challenge',
    statusBarStyle: 'default',
  },
};
export const viewport: Viewport = {
  themeColor: '#f6f8fb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Android shrinks the page for the keyboard, so a sheet's buttons stay above it (iOS: see Sheet).
  interactiveWidget: 'resizes-content',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
