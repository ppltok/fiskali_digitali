import type { Metadata } from 'next';
import { Suez_One, Heebo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const suez = Suez_One({
  weight: '400',
  subsets: ['hebrew', 'latin'],
  variable: '--font-suez',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
});

const plex_mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'פיסקלי דיגיטלי — שיחה עם תקציב המדינה',
  description:
    'שאלו כל שאלה על תקציב מדינת ישראל בעברית פשוטה, וקבלו תשובות מגובות בנתונים חיים ממפתח התקציב — עם תרשימים, מקורות ושקיפות מלאה.',
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230c6b5a"/><text x="50" y="72" font-size="62" text-anchor="middle" fill="%23f6f1e7" font-family="serif">₪</text></svg>'
          ),
        type: 'image/svg+xml',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body
        className={`${suez.variable} ${heebo.variable} ${plex_mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
