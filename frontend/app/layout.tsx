import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { SessionProvider } from '@/app/session'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reimbursely',
  description: 'Dashboard pengelolaan pengajuan reimburse untuk tim Anda.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  applicationName: 'Reimbursely',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Reimbursely',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  other: {
    'msapplication-TileColor': '#0A0A0A',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#0A0A0A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
