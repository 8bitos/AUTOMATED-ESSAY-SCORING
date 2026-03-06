import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // Import AuthProvider
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata = {
  title: "SAGE | Smart Academic Grading Engine",
  description: "LMS for automatic essay scoring and academic feedback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Suspense fallback={null}>
            <AuthProvider>{children}</AuthProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
