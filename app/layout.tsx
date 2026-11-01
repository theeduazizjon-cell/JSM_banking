import type { Metadata } from "next";
import { IBM_Plex_Serif, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter-family",
  subsets: ["latin"],
});

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-ibm-plex-serif-family",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Ledgerly",
    template: "%s · Ledgerly",
  },
  description: "Ledgerly links your bank accounts, shows balances and transactions in one place, and sends transfers. Runs on Plaid and Dwolla sandboxes.",
  icons: {
    icon: "/icons/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexSerif.variable} h-full antialiased`}
    >
      <body className="font-inter">
        {children}
      </body>
    </html>
  );
}
