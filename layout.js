export const metadata = {
  title: "Career Copilot",
  description: "Your career profile, resume, and cover letter generator.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
