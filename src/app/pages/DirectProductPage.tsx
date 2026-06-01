import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { ProductTemplate } from '@/app/components/product/ProductTemplate';
import { getProductBySlug } from '@/app/data/directProductsMap';
import { useProducts } from '@/app/context/ProductContext';
import { normalizeProductImages } from '@/app/utils/imageUtils';

export function DirectProductPage() {
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { products } = useProducts();
  
  // Extract slug from URL path if not available in params
  // For routes like /standard-startup-package, extract from pathname
  const slug = paramSlug || location.pathname.replace(/^\//, '').split('/')[0];
  
  const productData = getProductBySlug(slug);
  const resolvedProductData = useMemo(() => {
    if (!productData) return null;

    const normalizedSlug = slug.trim().toLowerCase();
    const matchedAdminProduct = products.find((product) => {
      const productId = (product.id || '').trim().toLowerCase();
      const productNameSlug = (product.name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      return productId === normalizedSlug || productNameSlug === normalizedSlug;
    });

    if (!matchedAdminProduct) {
      return productData;
    }

    const adminImages = normalizeProductImages(matchedAdminProduct.images, matchedAdminProduct.name);

    return {
      ...productData,
      title: matchedAdminProduct.name || productData.title,
      type: (matchedAdminProduct.category?.toLowerCase() as 'translation' | 'apostille' | 'attestation' | 'startup') || productData.type,
      images: adminImages.length > 0 ? adminImages : productData.images,
      price: matchedAdminProduct.price ?? productData.price,
      originalPrice: matchedAdminProduct.compareAtPrice || productData.originalPrice,
    };
  }, [productData, products, slug]);

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (!resolvedProductData) {
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
  return <ProductTemplate key={slug} data={resolvedProductData} productKey={productKey} />;
}

export default DirectProductPage;
