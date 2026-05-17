import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "הבית החכם v3.0",
  description: "ניהול ותזמון חכם למכשירי החשמל בבית",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
