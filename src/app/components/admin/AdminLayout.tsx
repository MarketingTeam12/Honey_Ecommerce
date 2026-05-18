import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  Home, Package, ShoppingCart, Users, TrendingUp,
  Store, BarChart3, Settings, Bell, Search,
  Menu, X, LogOut, ChevronDown, Plus, LayoutGrid, Tag, Trash2, Mail, MessageSquare, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import honeyLogo from 'figma:asset/d99fd9d20cac16122a3e457a66e96224eb5ad345.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, accessToken } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  // Load notifications from backend
  const loadNotifications = async () => {
    try {
      console.log('🔔 [AdminLayout] Loading notifications');
      console.log('🔔 [AdminLayout] Access Token:', accessToken ? (accessToken.substring(0, 20) + '...') : 'NULL');
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/notifications`;
      
      // CRITICAL FIX: Use publicAnonKey as Bearer token to satisfy Supabase infrastructure
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey
      };
      console.log('🔔 [AdminLayout] Using publicAnonKey for auth');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { 
        headers,
        signal: controller.signal 
      });
      
      clearTimeout(timeout);
      
      console.log('🔔 [AdminLayout] Notifications response status:', response.status, response.ok);
      
      if (response.ok) {
        const data = await response.json();
        const notifs = data.notifications || [];
        setNotifications(notifs);
        const unread = notifs.filter((n: any) => !n.read).length;
        console.log('📬 [AdminLayout] Loaded', notifs.length, 'notifications,', unread, 'unread');
      } else {
        // Check if it's a backend deployment issue
        const errorText = await response.text();
        const isBackendIssue = errorText.includes('Missing authorization header') || 
                               errorText.includes('Invalid JWT') || 
                               errorText.includes('"code":401');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - notifications disabled');
        } else {
          console.log('ℹ️ Notifications endpoint unavailable (non-critical)');
        }
        // Silently fail in the UI - notifications are not critical
        setNotifications([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Notifications request timed out (backend not responding)');
      } else {
        console.log('ℹ️ Could not load notifications (non-critical)');
      }
      // Silently fail - notifications are not critical
      setNotifications([]);
    }
  };

  // Initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    // Only load notifications if we have a valid access token or user
    // This prevents 401 errors on initial load before auth is ready
    if (user || accessToken) {
      loadNotifications();
    }
    
    // Listen for new order notifications
    const handleNewOrder = (event: any) => {
      console.log('🔔 [AdminLayout] New order notification received!', event.detail);
      loadNotifications(); // Reload notifications
    };
    
    // Listen for notification updates (mark as read, delete, etc.)
    const handleNotificationsUpdated = () => {
      console.log('🔄 [AdminLayout] Notifications updated, reloading...');
      loadNotifications();
    };
    
    window.addEventListener('newOrderNotification', handleNewOrder);
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);
    
    // Poll for new notifications with visibility check
    let interval: NodeJS.Timeout | null = null;

    const startInterval = () => {
      interval = setInterval(() => {
        if (!document.hidden && (user || accessToken)) {
          loadNotifications();
        }
      }, 10000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        if (!interval && (user || accessToken)) {
          startInterval();
        }
      }
    };

    if (user || accessToken) {
      startInterval();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('newOrderNotification', handleNewOrder);
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accessToken, user]); // Re-run when accessToken or user changes

  const markNotificationAsRead = async (notificationId: string) => {
    // Optimistic UI update so the badge decreases immediately.
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );

    try {
      const isMock = accessToken?.startsWith('mock-token-');
      const bearerToken = (!isMock && accessToken) ? accessToken : publicAnonKey;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
          },
        }
      );

      if (response.ok) {
        console.log('Notification marked as read:', notificationId);
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      } else {
        loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      loadNotifications();
    }
  };

  const navigation = [
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
    { name: 'Inventory', href: '/admin/inventory', icon: Users },
    { name: 'Orders', href: '/admin/sales/orders', icon: ShoppingCart },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Customer Emails', href: '/admin/customer-emails', icon: Mail },
    { name: 'Customer Queries', href: '/admin/customer-queries', icon: MessageSquare }
  ];

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
              Honey Universal Digital Pvt Ltd
            </Link>
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Plus className="w-5 h-5 text-white bg-red-600 rounded" />
            </button>
            
            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                className="p-2 hover:bg-gray-100 rounded-lg relative"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileDropdownOpen(false);
                }}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Panel */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 10).map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`p-4 hover:bg-gray-50 border-b border-gray-100 cursor-pointer ${
                            !notif.read ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            if (notif.type === 'new_order' && notif.order_id) {
                              navigate(`/admin/sales/orders/${notif.order_id}`);
                              setNotificationsOpen(false);
                            } else if (notif.type === 'customer_query') {
                              navigate('/admin/customer-queries');
                              setNotificationsOpen(false);
                            } else if (notif.type === 'email_subscription') {
                              navigate('/admin/customer-emails');
                              setNotificationsOpen(false);
                            }
                            markNotificationAsRead(notif.id);
                          }}
                        >
                          <div className="flex gap-3">
                            {/* Blue dot - only show for unread notifications */}
                            {!notif.read && (
                              <div className="w-2 h-2 rounded-full mt-2 bg-blue-500"></div>
                            )}
                            {/* Spacer for read notifications to maintain alignment */}
                            {notif.read && (
                              <div className="w-2 h-2 mt-2"></div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 font-medium">{notif.title}</p>
                              <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                              {notif.amount && (
                                <p className="text-xs text-gray-700 font-medium mt-1">
                                  {notif.currency === 'INR' ? '₹' : '$'}{parseFloat(notif.amount).toLocaleString('en-IN')}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notif.created_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-gray-200 text-center">
                    <button 
                      onClick={() => {
                        setNotificationsOpen(false);
                        navigate('/admin/notifications');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Button */}
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
                setNotificationsOpen(false);
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
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/admin/product-fields-config');
                      }}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <Link
                      to="/"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Store className="w-4 h-4" />
                      View Store
                    </Link>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/admin/data-cleanup');
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All Data
                    </button>
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

