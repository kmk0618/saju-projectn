import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나의사주 | 개인 맞춤 사주 리포트",
  description: "질문부터 시작하는 개인 맞춤 사주 리포트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
