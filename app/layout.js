import './globals.css';

export const metadata = {
  title: 'Attendance Registry',
  description: 'Polished spreadsheet view attendance portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
