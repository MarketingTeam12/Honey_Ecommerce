import { useParams, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ProductTemplate } from '@/app/components/product/ProductTemplate';
import { allProductsMap } from '@/app/data/allProductData';

export function ApostillePage() {
  const { country } = useParams<{ country?: string }>();
  const location = useLocation();
  
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

  // Use country as key to force re-render when navigating between products
  return <ProductTemplate key={country} data={productData} />;
}

export default ApostillePage;
