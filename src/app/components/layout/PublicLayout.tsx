import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HeaderNew } from '@/app/components/layout/HeaderNew';
import { FooterNew } from '@/app/components/layout/FooterNew';
import { WhatsAppButton } from '@/app/components/layout/WhatsAppButton';
import BackToTopButton from '@/app/components/layout/BackToTopButton';
import ScrollEffects from '@/app/components/layout/ScrollEffects';
import { PublicPageSkeleton } from '@/app/components/layout/PageSkeleton';
import { useAuth } from '@/app/context/AuthContext';
import { useProducts } from '@/app/context/ProductContext';

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();
  const { loading: authLoading } = useAuth();
  const { isLoading: productsLoading } = useProducts();
  const [routeLoading, setRouteLoading] = useState(true);

  useEffect(() => {
    setRouteLoading(true);
    const timeout = window.setTimeout(() => {
      setRouteLoading(false);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  const showSkeleton = authLoading || productsLoading || routeLoading;

  return (
    <div className="relative isolate min-h-screen bg-white flex flex-col">
      <ScrollEffects />
      <HeaderNew />
      <main className="relative z-10 flex-grow">
        {showSkeleton ? <PublicPageSkeleton /> : children}
      </main>
      <FooterNew />
      <WhatsAppButton />
      <BackToTopButton />
    </div>
  );
}

export default PublicLayout;
