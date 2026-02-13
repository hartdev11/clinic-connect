import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clinic Connect | AI-Powered Clinic Platform",
  description:
    "แพลตฟอร์มรวมคลินิกและระบบบริหารคลินิกด้วย AI สำหรับคลินิกความงาม ทันตกรรม และสปา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={plusJakarta.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
