import { ReactNode } from 'react';
import { HeaderNew } from '@/app/components/layout/HeaderNew';
import { FooterNew } from '@/app/components/layout/FooterNew';
import { WhatsAppButton } from '@/app/components/layout/WhatsAppButton';
import { CallWidget } from '@/app/components/layout/CallWidget';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <HeaderNew />
      <main className="flex-grow">
        {children}
      </main>
      <FooterNew />
      <CallWidget />
      <WhatsAppButton />
    </div>
  );
}

export default PublicLayout;
