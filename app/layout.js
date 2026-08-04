import './globals.css';

export const metadata = {
  title: 'NovaByte Host | Automated Instant Static Site Deployment',
  description: 'Deploy static HTML/CSS/JS websites instantly with native subdomains and HTTPS on novabyte-labs.com.',
  keywords: ['static hosting', 'cPanel automation', 'Next.js hosting platform', 'novabyte-labs'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-indigo-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
