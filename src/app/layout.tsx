import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
