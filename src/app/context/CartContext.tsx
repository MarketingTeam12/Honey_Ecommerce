import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  basePrice: number;
  category: string;
  url: string;
  image: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  certificateType?: string;
  uploadedDocument?: File | null; // Keep for backward compatibility
  uploadedDocuments?: File[]; // Support multiple documents
  documentPreview?: string;
  pageCount: number;
  totalPrice: number;
}

interface CartContextType {
  cartItems: CartItem[];
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updatePageCount: (id: string, pageCount: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  appliedCoupon: { code: string; discountValue: number; discountType: 'percentage' | 'fixed' } | null;
  applyCoupon: (code: string, discountValue: number, discountType: 'percentage' | 'fixed') => void;
  removeCoupon: () => void;
  getDiscountAmount: () => number;
  getFinalTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Add display name for better debugging
CartContext.displayName = 'CartContext';

export function CartProvider({ children }: { children: ReactNode }) {
  // Use lazy initialization with inline functions to avoid HMR issues
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedCart = localStorage.getItem('honey_cart');
      if (savedCart) {
        return JSON.parse(savedCart);
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
    return [];
  });
  
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountValue: number; discountType: 'percentage' | 'fixed' } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const savedCoupon = localStorage.getItem('honey_coupon');
      if (savedCoupon) {
        return JSON.parse(savedCoupon);
      }
    } catch (error) {
      console.error('Error loading coupon from storage:', error);
    }
    return null;
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('honey_cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  }, [cartItems]);

  // Persist coupon to localStorage whenever it changes
  useEffect(() => {
    try {
      if (appliedCoupon) {
        localStorage.setItem('honey_coupon', JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem('honey_coupon');
      }
    } catch (error) {
      console.error('Error saving coupon to storage:', error);
    }
  }, [appliedCoupon]);

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      const existingIndex = prev.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = item;
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const updatePageCount = (id: string, pageCount: number) => {
    setCartItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const totalPrice = item.basePrice * pageCount;
          return { ...item, pageCount, totalPrice };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const getCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const getCartCount = () => {
    return cartItems.length;
  };

  const applyCoupon = (code: string, discountValue: number, discountType: 'percentage' | 'fixed') => {
    setAppliedCoupon({ code, discountValue, discountType });
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const getDiscountAmount = () => {
    if (!appliedCoupon) return 0;
    const cartTotal = getCartTotal();
    if (appliedCoupon.discountType === 'percentage') {
      return (cartTotal * appliedCoupon.discountValue) / 100;
    } else {
      return appliedCoupon.discountValue;
    }
  };

  const getFinalTotal = () => {
    return getCartTotal() - getDiscountAmount();
  };

  const value: CartContextType = {
    cartItems,
    cart: cartItems,
    addToCart,
    removeFromCart,
    updatePageCount,
    clearCart,
    getCartTotal,
    getCartCount,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    getDiscountAmount,
    getFinalTotal,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Add display name for better debugging
CartProvider.displayName = 'CartProvider';

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}