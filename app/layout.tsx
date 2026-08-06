import type { Metadata } from 'next';
import { IBM_Plex_Sans_Hebrew, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

// alenu.org uses IBM Plex Sans Hebrew for body copy; their display face
// (COLBO) is proprietary, so headlines use Plex Hebrew at heavy weights.
const plex_hebrew = IBM_Plex_Sans_Hebrew({
  weight: ['400', '500', '600', '700'],
  subsets: ['hebrew', 'latin'],
  variable: '--font-plex-hebrew',
});

const plex_mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'דברו עם התקציב | עלינו',
  description:
    'אי אפשר לתקן את מה שלא רואים. שאלו כל שאלה על תקציב מדינת ישראל בעברית פשוטה, וקבלו תשובה מגובה בנתונים חיים ממפתח התקציב — עם מקורות, שאילתות גלויות ותרשימים. מערכת של תנועת עלינו.',
  metadataBase: new URL('https://fiskalidigitali.vercel.app'),
  openGraph: {
    title: 'דברו עם התקציב | עלינו',
    description:
      'אי אפשר לתקן את מה שלא רואים — שאלו כל שאלה על תקציב המדינה וקבלו תשובה מגובה בנתונים חיים.',
    locale: 'he_IL',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/alenu_mark.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/alenu_mark.svg' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${plex_hebrew.variable} ${plex_mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
