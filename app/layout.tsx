import type { Metadata } from "next";
import "./globals.css";
import { AppTopNav } from "../components/AppTopNav";

export const metadata: Metadata = {
  title: "盒中捏物 Neeeead!!!",
  description: "A creative tool to generate unique, organic shapes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+SC:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg text-text antialiased">
        <AppTopNav />
        {children}
      </body>
    </html>
  );
}
