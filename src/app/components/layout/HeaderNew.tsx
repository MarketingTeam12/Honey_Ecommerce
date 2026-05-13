import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { LogOut, User, Key, Shield, ChevronDown, Menu, X, ShoppingCart, Heart, Package, MapPin, MessageSquare } from 'lucide-react';
import { useCurrency } from '@/app/context/CurrencyContext';
import { useCart } from '@/app/context/CartContext';
import { useWishlist } from '@/app/context/WishlistContext';
import { useProducts } from '@/app/context/ProductContext';
import { useAuth } from '@/app/context/AuthContext';
import { CustomerNotificationBell } from '@/app/components/CustomerNotificationBell';
import { QueryModal } from '@/app/components/QueryModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import honeyLogo from 'figma:asset/8c2fe7ab481f5f0c43b276208d40db63dfe3a146.png';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { startupProducts } from '@/app/data/startupProductsList';
import { getFirstValidImage } from '@/app/utils/imageUtils';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  image?: string;
}

interface Category {
  name: string;
  slug: string;
  products: Product[];
}

export function HeaderNew() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const { currency, currencies, setCurrency } = useCurrency();
  const { getCartCount } = useCart();
  const { getWishlistCount } = useWishlist();
  const { products: adminProducts, categories: adminCategories } = useProducts();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


  // Build dynamic categories from admin products
  const categories: Category[] = adminCategories.map(category => ({
    name: category.name,
    slug: category.slug,
    products: adminProducts
      .filter(product => product.category === category.name && product.status === 'active')
      .map(product => ({
        id: product.id,
        name: product.name,
        slug: product.id, // Use ID as slug for routing
        price: product.price,
        image: getFirstValidImage(product.images)
      }))
  }));

  // Get category by name
  const getCategory = (name: string) => {
    return categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
  };

  // For "Language" dropdown, check both "Language" and "Translation" categories
  const languageCategory = getCategory('Language') || getCategory('Translation');
  const apostilleCategory = getCategory('Apostille');
  const attestationCategory = getCategory('Attestation');
  const startupCategory = getCategory('Startup') || getCategory('Startup Packages');
  
  const categoriesLoading = false; // Products are loaded synchronously from localStorage

  // Debug logging
  console.log('HeaderNew - Admin Products:', adminProducts);
  console.log('HeaderNew - Admin Categories:', adminCategories);
  console.log('HeaderNew - Built Categories:', categories);
  console.log('HeaderNew - Language Category:', languageCategory);

  // Check if current page is a "View All Services" page
  const isViewAllServicesPage = [
    '/all-language-products',
    '/all-translation-products',
    '/all-apostille-products',
    '/all-attestation-products',
    '/all-startup-products'
  ].includes(location.pathname);

  return (
    <>
      {/* Top Bar */}
      <div className="bg-[#1a1f5c] text-white px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6 text-[15px]">
            <a href="mailto:salesteam@honeytranslations.com" className="hover:text-gray-300 transition-colors">
              📧 salesteam@honeytranslations.com
            </a>
            <div className="flex items-center gap-3">
              <a href="tel:+917299005577" className="hover:text-gray-300 transition-colors">
                📞 +91 72990 05577
              </a>
            </div>
          </div>
          
          {/* Sign In/Out Button in Top Bar */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQueryModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full transition-all text-[14px] font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                  title="Submit your query"
                >
                  <MessageSquare className="w-4 h-4" />
                  Query
                </button>

                {/* Notification Bell */}
                <CustomerNotificationBell />
                
                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors">
                    <span className="text-white text-[15px]">Hi, {user.name?.split(' ')[0] || 'User'}</span>
                    <ChevronDown className="w-4 h-4 text-white" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 mt-2">
                    <DropdownMenuItem asChild>
                      <Link to="/my-profile" className="cursor-pointer">
                        <User className="w-4 h-4 mr-2" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/my-orders" className="cursor-pointer">
                        <Package className="w-4 h-4 mr-2" />
                        My Orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/my-address" className="cursor-pointer">
                        <MapPin className="w-4 h-4 mr-2" />
                        My Address
                      </Link>
                    </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sign Out Button */}
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-[15px]"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/signin')}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-[15px]"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white shadow-md sticky top-[56px] z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 flex-shrink-0">
              <img 
                src={honeyLogo} 
                alt="Honey Translation Services" 
                className="h-20 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6 flex-grow justify-center">
              <Link
                to="/"
                className="bg-[#1a1f5c] text-white px-6 py-2 rounded-full hover:bg-[#252b70] transition-colors font-bold"
              >
                Home
              </Link>

              {/* Language Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-[#1a1f5c] transition-colors font-bold">
                  Language <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuItem asChild>
                    <Link to="/all-translation-products" className="font-semibold text-blue-600">
                      📋 View All Translation Services
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categoriesLoading ? (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500">Loading...</span>
                    </DropdownMenuItem>
                  ) : languageCategory && languageCategory.products.length > 0 ? (
                    languageCategory.products.map(product => (
                      <DropdownMenuItem key={product.id} asChild>
                        <Link to={`/product/${product.id}`}>{product.name}</Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500 text-xs">No products - Please initialize products via Admin Panel</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Apostille Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-[#1a1f5c] transition-colors font-bold">
                  Apostille <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-96 overflow-y-auto">
                  <DropdownMenuItem asChild>
                    <Link to="/all-apostille-products" className="font-semibold text-blue-600">
                      🌍 View All Apostille Services
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categoriesLoading ? (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500">Loading...</span>
                    </DropdownMenuItem>
                  ) : apostilleCategory && apostilleCategory.products.length > 0 ? (
                    apostilleCategory.products.map(product => (
                      <DropdownMenuItem key={product.id} asChild>
                        <Link to={`/product/${product.id}`}>{product.name}</Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500">No products available</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Attestation Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-[#1a1f5c] transition-colors font-bold">
                  Attestation <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link to="/all-attestation-products" className="font-semibold text-blue-600">
                      ✅ View All Attestation Services
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {categoriesLoading ? (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500">Loading...</span>
                    </DropdownMenuItem>
                  ) : attestationCategory && attestationCategory.products.length > 0 ? (
                    attestationCategory.products.map(product => (
                      <DropdownMenuItem key={product.id} asChild>
                        <Link to={`/product/${product.id}`}>{product.name}</Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-gray-500">No products available</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Startup Package Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-[#1a1f5c] transition-colors font-bold">
                  Startup <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link to="/all-startup-products" className="font-semibold text-blue-600">
                      🚀 View All Startup Packages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {startupProducts.map(product => {
                    return (
                      <DropdownMenuItem key={product.id} asChild>
                        <Link to={product.url}>{product.name}</Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* More Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-[#1a1f5c] transition-colors font-bold">
                  More <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link to="/services">Services</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/contact-us">Contact Us</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/track-order">Track Your Order</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/terms-and-conditions">Terms and Conditions</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/privacy-policy">Privacy & Policy</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/refund-cancellation-policy">Refund and Cancellation Policy</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/faq">FAQ</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/blog">Blog</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/terms-of-service">Terms of Service</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Wishlist */}
              <Link
                to="/wishlist"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5 text-gray-700" />
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {getWishlistCount()}
                </span>
              </Link>

              {/* Cart - Hidden on View All Services pages */}
              {!isViewAllServicesPage && (
                <Link
                  to="/cart"
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                  aria-label="Cart"
                >
                  <ShoppingCart className="w-5 h-5 text-gray-700" />
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {getCartCount()}
                  </span>
                </Link>
              )}

              {/* Currency Selector Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Select Currency"
                  >
                    <img 
                      src={currency.flag} 
                      alt={currency.code} 
                      className="w-6 h-6 rounded-full object-cover border border-gray-200"
                    />
                    <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                      {currency.code}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {currencies.map((curr) => (
                    <DropdownMenuItem
                      key={curr.code}
                      onClick={() => setCurrency(curr)}
                      className={`flex items-center gap-3 cursor-pointer ${
                        currency.code === curr.code ? 'bg-blue-50' : ''
                      }`}
                    >
                      <img 
                        src={curr.flag} 
                        alt={curr.code} 
                        className="w-5 h-5 rounded-full object-cover border border-gray-200"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{curr.name}</div>
                        <div className="text-xs text-gray-500">{curr.code} ({curr.symbol})</div>
                      </div>
                      {currency.code === curr.code && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Toggle */}
              <button
                className="lg:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-6 py-4 space-y-3">
              {/* User Section in Mobile */}
              {user ? (
                <div className="border-b pb-3 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name || 'User'}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Link
                      to="/my-profile"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      to="/my-orders"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Package className="w-4 h-4" />
                      My Orders
                    </Link>
                    <Link
                      to="/my-address"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <MapPin className="w-4 h-4" />
                      My Address
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    navigate('/signin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
              
              <Link
                to="/"
                className="block px-4 py-2 bg-[#1a1f5c] text-white rounded-lg text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/all-translation-products"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Translation Services
              </Link>
              <Link
                to="/all-apostille-products"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Apostille Services
              </Link>
              <Link
                to="/all-attestation-products"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Attestation Services
              </Link>
              <Link
                to="/all-startup-products"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Startup Packages
              </Link>
              <Link
                to="/services"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </Link>
              <Link
                to="/contact"
                className="block px-4 py-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}>
                Contact
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Query Modal */}
      <QueryModal isOpen={queryModalOpen} onClose={() => setQueryModalOpen(false)} />
    </>
  );
}
