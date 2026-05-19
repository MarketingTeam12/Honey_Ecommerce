import { useEffect, useRef } from 'react';

const TRUSTINDEX_SCRIPT_SRC = 'https://cdn.trustindex.io/loader.js?18cf7ab7225a255f6c86ab7c666';

export function TrustIndexReviewsSection() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const script = document.createElement('script');
    script.src = TRUSTINDEX_SCRIPT_SRC;
    script.defer = true;
    script.async = true;
    mountRef.current.appendChild(script);

    return () => {
      if (mountRef.current?.contains(script)) {
        mountRef.current.removeChild(script);
      }
    };
  }, []);

  return (
    <section className="py-2 md:py-3 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="trustindex-home-widget" ref={mountRef} />
      </div>
      <style>{`
        .trustindex-home-widget [class*="write"][class*="review"],
        .trustindex-home-widget [class*="review"][class*="button"],
        .trustindex-home-widget a[href*="google"][href*="review"],
        .trustindex-home-widget button[class*="review"] {
          display: table !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .trustindex-home-widget [class*="verified"][class*="trustindex"],
        .trustindex-home-widget [class*="trustindex"][class*="verified"],
        .trustindex-home-widget [class*="ti-footer"],
        .trustindex-home-widget [class*="footer"] {
          display: table !important;
          margin-left: auto !important;
          margin-right: auto !important;
          text-align: center !important;
        }

        .trustindex-home-widget [class*="arrow"],
        .trustindex-home-widget [class*="nav"],
        .trustindex-home-widget [class*="prev"],
        .trustindex-home-widget [class*="next"] {
          display: none !important;
        }
      `}</style>
    </section>
  );
}
