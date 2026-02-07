import "./globals.css";

export const metadata = {
  title: "BrickLedger",
  description: "Enabling smart & transparent investing back at home"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-sand via-mist to-white">
        <div className="min-h-screen px-4 py-8 lg:px-10 lg:py-12">{children}</div>
      </body>
    </html>
  );
}