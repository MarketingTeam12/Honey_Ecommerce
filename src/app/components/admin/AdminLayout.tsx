import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Package, ShoppingCart, Users, TrendingUp,
  Store, BarChart3, Settings, Search,
  Menu, X, LogOut, ChevronDown, LayoutGrid, Tag, Mail, MessageSquare, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { hasAdminAccess, isFullAdmin } from '@/app/utils/roleAccess';
import honeyLogo from 'figma:asset/d99fd9d20cac16122a3e457a66e96224eb5ad345.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const canAccessAdmin = hasAdminAccess(user?.email, user?.role);
  const fullAdmin = isFullAdmin(user?.email, user?.role);

  useEffect(() => {
    if (!loading && !canAccessAdmin) {
      navigate('/signin?role=admin', { replace: true });
    }
  }, [loading, canAccessAdmin, navigate]);

  useEffect(() => {
    if (loading || !canAccessAdmin || fullAdmin) return;
    const allowedForSalesManager = [
      '/admin',
      '/admin/sales/orders',
      '/admin/sales/orders/',
      '/admin/reports',
      '/admin/notifications',
    ];
    const isAllowed = allowedForSalesManager.some((path) =>
      path.endsWith('/') ? location.pathname.startsWith(path) : location.pathname === path
    );
    if (!isAllowed) {
      navigate('/admin/sales/orders', { replace: true });
    }
  }, [loading, canAccessAdmin, fullAdmin, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-gray-600">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return null;
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const fullNavigation = [
    { name: 'Home', href: '/admin', icon: Home },
    { 
      name: 'Items', 
      href: '/admin/items', 
      icon: Package,
      expandedKey: 'items',
      children: [
        { name: 'All Items', href: '/admin/items' },
        { name: 'Add New Item', href: '/admin/items/new' },
        { name: 'Categories', href: '/admin/categories' },
        { name: 'Coupons', href: '/admin/coupons' },
        { name: 'Item Reviews', href: '/admin/item-reviews' }
      ]
    },
    { name: 'User Management', href: '/admin/customers', icon: Users },
    { name: 'Orders', href: '/admin/sales/orders', icon: ShoppingCart },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Customer Emails', href: '/admin/customer-emails', icon: Mail },
    { name: 'Customer Queries', href: '/admin/customer-queries', icon: MessageSquare }
  ];
  const salesManagerNavigation = [
    { name: 'Orders', href: '/admin/sales/orders', icon: ShoppingCart },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
  ];
  const navigation = fullAdmin ? fullNavigation : salesManagerNavigation;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#1a1f2e] text-white transition-transform duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <Store className="w-6 h-6 text-blue-400" />
                <span className="font-bold text-lg">Commerce</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-gray-700 rounded mx-auto"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((item) => {
            const isExpanded = item.expandedKey === 'items' ? itemsExpanded : item.expandedKey === 'sales' ? salesExpanded : false;
            const toggleExpanded = () => {
              if (item.expandedKey === 'items') setItemsExpanded(!itemsExpanded);
              if (item.expandedKey === 'sales') setSalesExpanded(!salesExpanded);
            };

            if (item.children) {
              return (
                <div key={item.name}>
                  <button
                    onClick={toggleExpanded}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-700 transition-colors ${
                      location.pathname.startsWith(item.href) ? 'bg-red-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {sidebarOpen && <span>{item.name}</span>}
                    </div>
                    {sidebarOpen && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>
                  {sidebarOpen && isExpanded && (
                    <div className="bg-gray-800">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={`block px-12 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors ${
                            location.pathname === child.href ? 'bg-gray-700 text-white' : ''
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-red-600 transition-colors ${
                  location.pathname === item.href ? 'bg-gray-700 text-white' : ''
                }`}
              >
                <item.icon className="w-5 h-5" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="min-h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 py-2 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative flex-1 max-w-md min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search in Customers ( / )"
                className="w-full min-w-0 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 hidden xl:block">
              Honey Translation Services
            </Link>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => navigate('/admin/product-fields-config')}
              title="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            {/* Profile Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                setProfileDropdownOpen(!profileDropdownOpen);
              }}>
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {user?.name?.[0] || 'A'}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <p className="font-semibold text-gray-900">{user?.name || 'Admin'}</p>
                    <p className="text-sm text-gray-500">{user?.email || 'admin@honey.com'}</p>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Home className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      to="/"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Store className="w-4 h-4" />
                      View Store
                    </Link>
                  </div>
                  <div className="p-2 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

