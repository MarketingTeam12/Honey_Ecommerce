import { useParams, useNavigate, useLocation } from 'react-router';
import { useEffect } from 'react';
import { ProductTemplate } from '@/app/components/product/ProductTemplate';
import { getProductBySlug } from '@/app/data/directProductsMap';

export function DirectProductPage() {
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract slug from URL path if not available in params
  // For routes like /standard-startup-package, extract from pathname
  const slug = paramSlug || location.pathname.replace(/^\//, '').split('/')[0];
  
  const productData = getProductBySlug(slug);

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (!productData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600">The product you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Extract product key from slug (e.g., "sworn-translation-german" -> use slug as key)
  const productKey = slug.replace(/^(product|apostille|attestation|startup)\//, '');

  // Use slug as key to force re-render when navigating between products
  return <ProductTemplate key={slug} data={productData} productKey={productKey} />;
}

export default DirectProductPage;