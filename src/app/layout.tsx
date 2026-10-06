import type {
  Metadata,
} from "next";

import "@/app/globals.css";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: {
    default:
      "NTP Quotation Management",
    template:
      "%s | NTP Quotation Management",
  },

  description:
    "Quotation management system for NTP Electric and Engineering Co., Ltd.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>
        <div className="min-h-screen bg-[#f7f8fc]">
          <AppSidebar />

          <div className="min-h-screen lg:pl-[260px]">
            <AppHeader />

            <main className="px-5 py-6 md:px-7 lg:px-9">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}