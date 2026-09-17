import type { Metadata } from 'next';
import './globals.css';
// Fee receipt, preset and verification styles for the GenLayer Transaction Kit
// React adapter used by the transaction surfaces.
import '@genlayer/transaction-kit-react/styles.css';
export const metadata: Metadata = {
  title: 'ProofDesk | Research with receipts',
  description:
    'Commission research, inspect cited claims, and review evidence through GenLayer.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
