import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { uploadImage } from '@/app/utils/supabaseStorage';
import { projectId } from '@/utils/supabase/info';
import { buildHeaders } from '@/app/utils/buildHeaders';

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  stock: number;
  weight?: string;
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  metaTitle?: string;
  metaDescription?: string;
  images: string[]; // Stores Supabase Storage URLs
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parentId?: string;
  createdAt: string;
}

interface ProductContextType {
  products: Product[];
  categories: Category[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  addCategory: (category: Omit<Category, 'id' | 'createdAt'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  uploadImages: (files: (File | string)[]) => Promise<string[]>;
  isLoading: boolean;
  refreshProducts: () => Promise<void>;
}

// Create and export the context with a default value
const defaultContextValue: ProductContextType = {
  products: [],
  categories: [],
  addProduct: async () => {},
  updateProduct: async () => {},
  deleteProduct: async () => {},
  getProduct: () => undefined,
  addCategory: () => {},
  updateCategory: () => {},
  deleteCategory: () => {},
  uploadImages: async () => [],
  isLoading: true,
  refreshProducts: async () => {},
};

export const ProductContext = createContext<ProductContextType>(defaultContextValue);

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635`;
const PRODUCTS_STORAGE_KEY = 'admin_products';
const CATEGORIES_STORAGE_KEY = 'admin_categories';

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const storedValue = localStorage.getItem(key);
    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(storedValue) as T;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage:`, error);
    return fallback;
  }
}

function writeStoredJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write ${key} to localStorage:`, error);
  }
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(() =>
    typeof window === 'undefined'
      ? []
      : readStoredJson<Product[]>(PRODUCTS_STORAGE_KEY, []),
  );
  const [categories, setCategories] = useState<Category[]>([
    {
      id: '1',
      name: 'Translation',
      slug: 'translation',
      description: 'Translation services',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Attestation',
      slug: 'attestation',
      description: 'Document attestation services',
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Apostille',
      slug: 'apostille',
      description: 'Apostille services',
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Startup Packages',
      slug: 'startup',
      description: 'Startup package services',
      createdAt: new Date().toISOString()
    }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fetch products from server on mount
  const fetchProducts = async () => {
    try {
      console.log('📦 Fetching products from server...');
      console.log('API URL:', API_URL);
      setIsLoading(true);
      setHasError(false);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log('⏱️ Request timed out after 10s - Edge Function server not deployed or not responding');
        controller.abort();
      }, 10000); // 10 second timeout
      
      const response = await fetch(`${API_URL}/products`, {
        method: 'GET',
        headers: buildHeaders(),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if it's a backend deployment issue (401 with Missing authorization header or Invalid JWT)
        const isBackendIssue = errorText.includes('Missing authorization header') || 
                               errorText.includes('Invalid JWT') || 
                               errorText.includes('"code":401');
        
        if (isBackendIssue) {
          console.log('ℹ️ [ProductContext] Backend not deployed - using local demo mode');
          console.log('   → To enable backend features, deploy Edge Functions');
          // Throw to trigger fallback mode
          throw new Error('Backend not available');
        }
        
        console.error('Response error:', errorText);
        console.error('❌ [ProductContext] Failed to fetch products');
        console.error('   Status:', response.status, response.statusText);
        console.error('   Error:', errorText);
        
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Fetched ${data.products?.length || 0} products from server`);
      console.log('Products data:', data.products);
      
      // If no products exist, initialize with defaults
      if (!data.products || data.products.length === 0) {
        console.log('📭 No products found on server. App will use default categories.');
        setProducts([]);
        writeStoredJson(PRODUCTS_STORAGE_KEY, []);
      } else {
        const normalizedProducts = data.products || [];
        setProducts(normalizedProducts);
        writeStoredJson(PRODUCTS_STORAGE_KEY, normalizedProducts);
      }
      
      setIsLoading(false);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('⚠️ Server request timed out - Edge Function not deployed. App will work with limited functionality.');
      } else {
        console.log('⚠️ Server not reachable:', error.message, '- Edge Function not deployed. App will work with limited functionality.');
      }
      // Don't set error state - just use defaults silently
      const storedProducts = readStoredJson<Product[]>(PRODUCTS_STORAGE_KEY, []);
      setProducts(storedProducts);
      setIsLoading(false);
      setHasError(false); // Don't show error to user, just use defaults
    }
  };

  // Initialize default products
  const initializeDefaultProducts = async () => {
    try {
      console.log('🌱 Calling initialize-default-products endpoint...');
      
      const response = await fetch(`${API_URL}/initialize-default-products`, {
        method: 'POST',
        headers: buildHeaders(),
      });
      
      if (!response.ok) {
        console.error('Failed to initialize default products');
        return;
      }
      
      const data = await response.json();
      console.log(`✅ Initialized ${data.count} default products`);
    } catch (error) {
      console.error('❌ Error initializing default products:', error);
    }
  };

  // Fetch categories from server
  const fetchCategories = async () => {
    try {
      console.log('📂 Fetching categories from server...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // Reduced to 5 second timeout
      
      const response = await fetch(`${API_URL}/categories-list`, {
        method: 'GET',
        headers: buildHeaders(),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      console.log('Categories response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if it's a backend deployment issue
        const isBackendIssue = errorText.includes('Missing authorization header') || 
                               errorText.includes('Invalid JWT') || 
                               errorText.includes('\"code\":401');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - using default categories');
          // Throw to trigger fallback mode
          throw new Error('Backend not available');
        }
        
        console.error('Categories response error:', errorText);
        console.error('❌ [ProductContext] Failed to fetch categories');
        console.error('   Status:', response.status, response.statusText);
        console.error('   Error:', errorText);
        
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Fetched ${data.categories?.length || 0} categories from server`);
      
      if (data.categories && data.categories.length > 0) {
        // Add createdAt to categories if missing
        const categoriesWithDates = data.categories.map(cat => ({
          ...cat,
          createdAt: cat.createdAt || new Date().toISOString()
        }));
        setCategories(categoriesWithDates);
        writeStoredJson(CATEGORIES_STORAGE_KEY, categoriesWithDates);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Using default categories (backend not responding)');
      } else {
        console.log('ℹ️ Using default categories:', error.message);
      }
      // Keep default categories - already set in state initialization
    }
  };

  // Load data on mount
  useEffect(() => {
    console.log('🚀 ProductProvider initializing...');
    fetchProducts();
    
    // Fetch categories in the background (non-blocking)
    fetchCategories().catch(err => {
      console.log('ℹ️ Categories fetch failed, using defaults:', err.message);
    });
  }, []);

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('🆕 Creating new product on server...');
      
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(productData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }
      
      const data = await response.json();
      console.log('✅ Product created on server:', data.product);
      
      // Add to local state
      setProducts(prev => {
        const nextProducts = [...prev, data.product];
        writeStoredJson(PRODUCTS_STORAGE_KEY, nextProducts);
        return nextProducts;
      });
      
      return data.product;
    } catch (error) {
      console.error('❌ Error creating product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      console.log(`📝 Updating product on server: ${id}`);
      
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify(productData)
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update product';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('✅ Product updated on server:', data.product);
      
      // Update local state
      setProducts(prev => {
        const nextProducts = prev.map(product => product.id === id ? data.product : product);
        writeStoredJson(PRODUCTS_STORAGE_KEY, nextProducts);
        return nextProducts;
      });
    } catch (error) {
      console.error('❌ Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      console.log(`🗑️ Deleting product from server: ${id}`);
      console.log(`📍 Product exists in local state: ${products.find(p => p.id === id) ? 'YES' : 'NO'}`);
      
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete product';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error(`❌ Server error response:`, errorData);
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      console.log('✅ Product deleted from server');
      
      // Remove from local state
      setProducts(prev => {
        const nextProducts = prev.filter(product => product.id !== id);
        writeStoredJson(PRODUCTS_STORAGE_KEY, nextProducts);
        return nextProducts;
      });
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
    }
  };

  const getProduct = (id: string) => {
    const normalizedId = id.trim().toLowerCase();
    const requestTier = normalizedId.includes('premium')
      ? 'premium'
      : normalizedId.includes('standard')
        ? 'standard'
        : normalizedId.includes('basic')
          ? 'basic'
          : '';
    const requestAliases = new Set([
      normalizedId,
      normalizedId.replace(/-package$/, ''),
      normalizedId.replace(/-packages$/, ''),
    ]);

    const product = products.find((product) => {
      const productId = (product.id || '').trim().toLowerCase();
      const productNameSlug = (product.name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const productCategory = (product.category || '').trim().toLowerCase();
      const categoryLooksStartup = productCategory.includes('startup');

      if (productId === normalizedId || productNameSlug === normalizedId) {
        return true;
      }

      if (categoryLooksStartup && requestAliases.has(productNameSlug)) {
        return true;
      }

      if (categoryLooksStartup && requestTier) {
        return (
          productNameSlug.includes(requestTier) ||
          (product.name || '').trim().toLowerCase().includes(requestTier)
        );
      }

      return false;
    });
    console.log('🔎 getProduct called:', {
      requestedId: id,
      found: !!product,
      productName: product?.name,
      imageCount: product?.images?.length,
      totalProducts: products.length
    });
    return product;
  };

  const addCategory = (categoryData: Omit<Category, 'id' | 'createdAt'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    setCategories(prev => {
      const nextCategories = [...prev, newCategory];
      writeStoredJson(CATEGORIES_STORAGE_KEY, nextCategories);
      return nextCategories;
    });
  };

  const updateCategory = (id: string, categoryData: Partial<Category>) => {
    setCategories(prev => {
      const nextCategories = prev.map(category =>
        category.id === id ? { ...category, ...categoryData } : category
      );
      writeStoredJson(CATEGORIES_STORAGE_KEY, nextCategories);
      return nextCategories;
    });
  };

  const deleteCategory = (id: string) => {
    setCategories(prev => {
      const nextCategories = prev.filter(category => category.id !== id);
      writeStoredJson(CATEGORIES_STORAGE_KEY, nextCategories);
      return nextCategories;
    });
  };

  const uploadImages = async (files: (File | string)[]) => {
    const imageUrls: string[] = [];
    for (const file of files) {
      if (typeof file === 'string') {
        // Check if it's a base64 data URL or an already-uploaded URL
        if (file.startsWith('data:')) {
          // It's base64, need to upload it
          console.log('🔄 Converting base64 to Supabase Storage URL...');
          const url = await uploadImage(file);
          if (url) {
            imageUrls.push(url);
          }
        } else if (file.startsWith('http://') || file.startsWith('https://')) {
          // Already a valid URL, keep it
          console.log('✅ Using existing URL:', file);
          imageUrls.push(file);
        } else {
          console.warn('⚠️ Skipping invalid image string:', file.substring(0, 50));
        }
      } else {
        // Upload the file
        console.log('📤 Uploading file to Supabase Storage...');
        const url = await uploadImage(file);
        if (url) {
          imageUrls.push(url);
        }
      }
    }
    return imageUrls;
  };

  const refreshProducts = async () => {
    await fetchProducts();
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        getProduct,
        addCategory,
        updateCategory,
        deleteCategory,
        uploadImages,
        isLoading,
        refreshProducts,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  return context;
}
