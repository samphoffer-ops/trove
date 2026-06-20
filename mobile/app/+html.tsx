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
        <meta name="theme-color" content={Colors.bg} />
        <ScrollViewStyleReset />
        <style id="trove-html-bg">{`
          html, body, #root { background-color: ${Colors.bg}; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
