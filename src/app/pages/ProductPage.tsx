import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ProductTemplate } from '@/app/components/product/ProductTemplate';
import { productDataMap } from '@/app/data/productData';
import { startupPackagesData } from '@/app/data/startupPackageData';
import { useProducts } from '@/app/context/ProductContext';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { buildHeaders } from '@/app/utils/buildHeaders';
import { useAuth } from '@/app/context/AuthContext';
import { normalizeProductImages } from '@/app/utils/imageUtils';

interface ProductConfig {
  showSourceLanguage: boolean;
  showTargetLanguage: boolean;
  showDocumentType: boolean;
  enabledSourceLanguages: string[];
  enabledTargetLanguages: string[];
  enabledDocumentTypes: string[];
}

interface Language {
  id: string;
  label: string;
  type: 'source' | 'target';
}

interface DocumentType {
  id: string;
  label: string;
}

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { getProduct } = useProducts();
  const { user } = useAuth();
  const [productConfig, setProductConfig] = useState<ProductConfig | null>(null);
  const [allSourceLanguages, setAllSourceLanguages] = useState<Language[]>([]);
  const [allTargetLanguages, setAllTargetLanguages] = useState<Language[]>([]);
  const [allDocumentTypes, setAllDocumentTypes] = useState<DocumentType[]>([]);
  
  // Get product from admin context
  const adminProduct = getProduct(id || '');
  
  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);
  
  // Fetch product configuration in the background (non-blocking)
  useEffect(() => {
    if (!id || !adminProduct) return;
    
    const fetchData = async () => {
      try {
        // Build headers with auth token (or anon key for unauthenticated requests)
        const headers = buildHeaders(user?.access_token);
        
        // Fetch all data in parallel for faster loading
        const [configResponse, languagesResponse, docTypesResponse] = await Promise.all([
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/admin/product-config/${id}`,
            { headers }
          ),
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/admin/languages`,
            { headers }
          ),
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/admin/document-types`,
            { headers }
          )
        ]);
        
        // Process config response
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.config) {
            setProductConfig(configData.config);
          }
        }
        
        // Process languages response
        if (languagesResponse.ok) {
          const languagesData = await languagesResponse.json();
          setAllSourceLanguages(languagesData.sourceLanguages || []);
          setAllTargetLanguages(languagesData.targetLanguages || []);
        }
        
        // Process document types response
        if (docTypesResponse.ok) {
          const docTypesData = await docTypesResponse.json();
          setAllDocumentTypes(docTypesData.documentTypes || []);
        }
      } catch (error) {
        console.error('Error fetching product configuration:', error);
      }
    };
    
    fetchData();
  }, [id, adminProduct, user?.access_token]);
  
  // Build product data with useMemo to avoid unnecessary recalculations
  const productData = useMemo(() => {
    const staticFallbackProduct =
      productDataMap[id || 'english-to-foreign'] || productDataMap['english-to-foreign'];

    if (!adminProduct) {
      // Fallback to static product data
      return staticFallbackProduct;
    }
    
    // Helper functions
    const convertLanguages = (languages: Language[], enabledIds: string[]) => {
      return languages
        .filter(lang => enabledIds.includes(lang.id))
        .map(lang => ({
          value: lang.id,
          label: lang.label
        }));
    };
    
    const convertDocumentTypes = (docTypes: DocumentType[], enabledIds: string[]) => {
      return docTypes
        .filter(doc => enabledIds.includes(doc.id))
        .map(doc => ({
          id: doc.id,
          label: doc.label
        }));
    };
    
    // Determine which fields to show based on product configuration
    const showSourceLanguage = productConfig?.showSourceLanguage ?? true;
    const showTargetLanguage = productConfig?.showTargetLanguage ?? true;
    // Hide document type for startup packages
    const isStartupPackage = adminProduct.category.toLowerCase() === 'startup';
    const showDocumentType = isStartupPackage ? false : (productConfig?.showDocumentType ?? true);
    
    console.log(' ProductPage Debug:', {
      productName: adminProduct.name,
      category: adminProduct.category,
      isStartupPackage,
      showDocumentType
    });
    
    // For startup packages, try to get highlights from static data
    let highlights = [
      { text: 'Professional and certified service' },
      { text: 'Fast turnaround time' },
      { text: 'Experienced team' },
      { text: 'Quality guaranteed' }
    ];
    
    if (isStartupPackage) {
      // Try to match startup package by name
      const startupKey = Object.keys(startupPackagesData).find(key => 
        startupPackagesData[key].title.toLowerCase() === adminProduct.name.toLowerCase()
      );
      
      if (startupKey && startupPackagesData[startupKey].highlights) {
        highlights = startupPackagesData[startupKey].highlights;
        console.log('âœ… Using static highlights for startup package:', startupKey);
      }
    }
    
    // Build source languages array
    let sourceLanguages = undefined;
    if (showSourceLanguage && productConfig?.enabledSourceLanguages?.length && allSourceLanguages.length > 0) {
      sourceLanguages = convertLanguages(allSourceLanguages, productConfig.enabledSourceLanguages);
    }
    
    // Build target languages array
    let targetLanguages = undefined;
    if (showTargetLanguage && productConfig?.enabledTargetLanguages?.length && allTargetLanguages.length > 0) {
      targetLanguages = convertLanguages(allTargetLanguages, productConfig.enabledTargetLanguages);
    }
    
    // Build document types array
    let documentTypes = [];
    if (showDocumentType) {
      if (productConfig?.enabledDocumentTypes?.length && allDocumentTypes.length > 0) {
        documentTypes = convertDocumentTypes(allDocumentTypes, productConfig.enabledDocumentTypes);
      } else {
        // Fallback to default document types if none configured
        documentTypes = [
          { id: 'birth-certificate', label: 'Birth Certificate' },
          { id: 'marriage-certificate', label: 'Marriage Certificate' },
          { id: 'academic-certificate', label: 'Academic Certificate' },
          { id: 'academic-marksheet', label: 'Academic Marksheet' },
          { id: 'pcc', label: 'Police Clearance Certificate (PCC)' },
          { id: 'divorce-decree', label: 'Divorce Decree' },
          { id: 'ration-card', label: 'Ration Card' },
          { id: 'court-papers', label: 'Court Papers' },
          { id: 'medical-certificate', label: 'Medical Certificate' },
          { id: 'driving-license', label: 'Driving License' },
        ];
      }
    }
    
    const normalizedAdminImages = normalizeProductImages(adminProduct.images, adminProduct.name);
    const fallbackStaticImages = normalizeProductImages(staticFallbackProduct.images, adminProduct.name);
    const resolvedImages =
      normalizedAdminImages.length > 0
        ? normalizedAdminImages
        : fallbackStaticImages.length > 0
          ? fallbackStaticImages
          : [{ url: '', alt: adminProduct.name }];

    return {
      type: adminProduct.category.toLowerCase() as 'translation' | 'apostille' | 'attestation' | 'startup',
      title: adminProduct.name,
      images: resolvedImages,
      price: adminProduct.price,
      originalPrice: adminProduct.compareAtPrice || adminProduct.price * 1.25,
      highlights,
      sourceLanguages,
      targetLanguages,
      documentTypes,
      productDetails: [
        adminProduct.description || 'Professional service provided by Honey Translation Services',
        'High-quality results guaranteed',
        'Experienced and certified professionals',
        'Timely delivery'
      ],
      whatYouReceive: [
        'Professionally completed service',
        'Digital copy via email',
        'Hard copy if requested',
        'Certificate of completion'
      ],
      processSteps: [
        { step: 1, title: 'Submit Request', description: 'Upload your documents and fill in the required details' },
        { step: 2, title: 'Processing', description: 'Our team processes your request professionally' },
        { step: 3, title: 'Quality Check', description: 'Thorough quality assurance and verification' },
        { step: 4, title: 'Delivery', description: 'Receive your completed service' }
      ],
      deliveryTimeline: {
        softCopy: '3-5 business days',
        hardCopy: '7-10 business days'
      },
      whyChoose: [
        'Professional and certified service providers',
        'Fast and reliable service',
        'Competitive pricing',
        'Quality guaranteed',
        'Excellent customer support'
      ],
      relatedProducts: [],
      sku: adminProduct.sku
    };
  }, [adminProduct, id, productConfig, allSourceLanguages, allTargetLanguages, allDocumentTypes]);

  // Render immediately - no loading states!
  return <ProductTemplate data={productData} productKey={id || 'english-to-foreign'} />;
}

export default ProductPage;

