export const metadata = { title: "מלאי מסגרות" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f4", color: "#1c1917" }}>
        {children}
      </body>
    </html>
  );
}
