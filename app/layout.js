import './globals.css';

export const metadata = {
  title: 'Fresher | Fresh Foods & Cereals',
  description: 'Order fresh foods and cereals online across Kenya.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
