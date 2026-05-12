import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  url: string;
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  getWishlistCount: () => number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(() => {
    // Load from localStorage on initialization
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage whenever wishlist changes
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const addToWishlist = (item: WishlistItem) => {
    setWishlistItems(prev => {
      // Check if item already exists
      if (prev.some(existing => existing.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeFromWishlist = (id: string) => {
    setWishlistItems(prev => prev.filter(item => item.id !== id));
  };

  const isInWishlist = (id: string): boolean => {
    return wishlistItems.some(item => item.id === id);
  };

  const getWishlistCount = (): number => {
    return wishlistItems.length;
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        getWishlistCount,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
