import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import StoryMode from "@/components/StoryMode";

export const metadata: Metadata = {
  title: "Pretty Fly · Working Capital OS",
  description: "Operator console — StockSense, Cash Radar, Backtest, WC Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
          <StoryMode />
        </div>
      </body>
    </html>
  );
}
