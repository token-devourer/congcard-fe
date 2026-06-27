import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Fredoka, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AnimationProvider } from "@/components/AnimationProvider";
import { UiSoundLayer } from "@/components/UiSoundLayer";
import "./globals.css";

const fontDisplay = Fredoka({
  subsets: ["latin"],
  variable: "--font-display"
});

const fontBody = Nunito({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "CongCard",
  description: "CongCard, a confident real-time multiplayer card game for private rooms.",
  icons: {
    icon: "/icon.svg"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${fontDisplay.variable} ${fontBody.variable}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AnimationProvider>
            <UiSoundLayer />
            {children}
          </AnimationProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
