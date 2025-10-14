// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import CookieConsentBar from "@/components/ads/CookieConsentBar";

export const metadata: Metadata = {
  title: "BitGremlin — Dark, Fast, Useful Tools",
  description: "We chew your bits and spit out something useful. Converters, media tools, and more."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg)] text-[var(--fg)] antialiased">
        <div className="bg-noise" />
        <CookieConsentBar />

        <Script id="bg-ads-loader" strategy="lazyOnload">
          {`
            (function () {
              try {
                var consent = localStorage.getItem('bg_consent');
                if (consent === 'granted' || consent === 'npa') {
                  if (!document.getElementById('adsbygoogle-script')) {
                    var s = document.createElement('script');
                    s.id = 'adsbygoogle-script';
                    s.async = true;
                    s.crossOrigin = 'anonymous';
                    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxxxxxxxxxx';
                    document.head.appendChild(s);
                  }
                  var tries = 0;
                  var i = setInterval(function () {
                    tries++;
                    var ads = (window && window['adsbygoogle']) ? window['adsbygoogle'] : null;
                    if (ads) {
                      document.querySelectorAll('ins.adsbygoogle').forEach(function () {
                        try { ads.push({}); } catch (e) {}
                      });
                      clearInterval(i);
                    }
                    if (tries > 15) clearInterval(i);
                  }, 600);
                }
              } catch (e) {}
            })();
          `}
        </Script>

        {children}
      </body>
    </html>
  );
}
