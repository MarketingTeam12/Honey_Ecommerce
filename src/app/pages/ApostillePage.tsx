import { useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ProductTemplate } from '@/app/components/product/ProductTemplate';
import { allProductsMap } from '@/app/data/allProductData';
import { useProducts } from '@/app/context/ProductContext';
import { normalizeProductImages } from '@/app/utils/imageUtils';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/services?/g, '')
    .replace(/apostille|attestation|startup|package/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function ApostillePage() {
  const { country } = useParams<{ country?: string }>();
  const location = useLocation();
  const { products } = useProducts();

  // Determine product type from URL path
  const isApostille = location.pathname.includes('/apostille/');
  const isAttestation = location.pathname.includes('/attestation/');
  const isStartup = location.pathname.includes('/startup/');

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [country]);

  // Get product data based on URL, fallback to saudi-arabia apostille
  let productData = allProductsMap[country || 'saudi-arabia'];

  // If product not found, provide a default based on type
  if (!productData) {
    if (isApostille) {
      productData = allProductsMap['saudi-arabia'];
    } else if (isAttestation) {
      productData = allProductsMap['china'];
    } else if (isStartup) {
      productData = allProductsMap['basic'];
    } else {
      productData = allProductsMap['saudi-arabia'];
    }
  }

  // Match admin product by country slug and override static content with admin-managed fields
  const routeCountry = country || '';
  const expectedCategory = isApostille
    ? 'apostille'
    : isAttestation
      ? 'attestation'
      : isStartup
        ? 'startup packages'
        : '';

  const adminMatch = products.find((product) => {
    if (product.status !== 'active') return false;
    if (!product.name) return false;
    if (expectedCategory && product.category.toLowerCase() !== expectedCategory) return false;
    return slugify(product.name) === routeCountry;
  });

  if (adminMatch) {
    const adminImages = normalizeProductImages(adminMatch.images, adminMatch.name);

    productData = {
      ...productData,
      title: adminMatch.name || productData.title,
      price: adminMatch.price || productData.price,
      originalPrice: adminMatch.compareAtPrice || productData.originalPrice,
      images: adminImages.length > 0 ? adminImages : productData.images,
      productDetails: adminMatch.description
        ? [adminMatch.description, ...productData.productDetails]
        : productData.productDetails,
    };
  }

  // Use country as key to force re-render when navigating between products
  return <ProductTemplate key={country} data={productData} productKey={adminMatch?.id || country} />;
}

export default ApostillePage;
