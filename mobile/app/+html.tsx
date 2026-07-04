import { ScrollViewStyleReset } from 'expo-router/html';
import { Colors } from '@/lib/theme';

// Custom root HTML for web — sets a real background color on html/body so
// Safari's overscroll bounce and the safe-area/notch strip don't flash white
// before the page background paints, and adds viewport-fit=cover so content
// can sit correctly behind the iPhone notch/home-indicator area.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* Browser chrome color — matches the ink masthead */}
        <meta name="theme-color" content={Colors.ink} />

        {/* SVG favicon for browser tabs (Chrome, Firefox, Safari 14+) */}
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230D1035'/%3E%3Ccircle cx='16' cy='16' r='9.5' fill='%23FF4422'/%3E%3C/svg%3E" />
        {/* PNG fallback */}
        <link rel="icon" type="image/png" href="/favicon.png" />

        {/* iOS "Add to Home Screen" icon — replace favicon.png with a 512×512 branded PNG */}
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />

        {/* iOS web app behaviour — full-screen, no Safari chrome */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="trove" />

        <ScrollViewStyleReset />
        <style id="trove-html-bg">{`
          html, body, #root { background-color: ${Colors.bg}; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
