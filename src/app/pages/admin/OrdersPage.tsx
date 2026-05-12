import { useState, useEffect } from 'react';
import { AdminLayout } from '@/app/components/admin/AdminLayout';
import { Copy, ChevronRight, Eye, FileText, Download, Truck, CreditCard, Paperclip, RefreshCw, Trash2, Database, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { useAuth } from '@/app/context/AuthContext';
import { buildHeaders } from '@/app/utils/buildHeaders';
import { generateInvoicePDF } from '@/app/utils/generateInvoicePDF';

const ORDERS_STORAGE_KEY = 'honey_translation_orders';
const DELETED_ORDERS_KEY = 'honey_translation_deleted_orders';

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  data?: string; // Optional - excluded in list view for performance
  hasFile?: boolean; // Flag to indicate file exists (used in list view)
}

interface OrderItem {
  id: string;
  name: string;
  basePrice: number;
  totalPrice: number;
  pageCount: number;
  sourceLanguage?: string;
  targetLanguage?: string;
  certificateType?: string;
  documentType?: string;
  uploadedFile?: UploadedFile | null; // Keep for backward compatibility
  uploadedFiles?: UploadedFile[]; // Support multiple files
}

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  payment_method: string;
  payment_status: string;
  status: string;
  total_amount: string;
  subtotal: string;
  discount: string;
  tax: string;
  currency: string;
  items: OrderItem[];
  shipping_address?: any;
  tracking_number?: string;
  shipping_carrier?: string;
  shipping_method?: string;
  estimated_delivery?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  tip?: number;
  created_at: string;
  updated_at: string;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  useEffect(() => {
    fetchOrders();
    
    // Listen for new order events
    const handleNewOrder = () => {
      console.log('🔔 [OrdersPage] New order event received, refreshing...');
      fetchOrders();
    };
    
    window.addEventListener('newOrderNotification', handleNewOrder);
    
    return () => {
      window.removeEventListener('newOrderNotification', handleNewOrder);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      console.log('📡 [OrdersPage] Fetching orders from all sources...');
      
      // ===== SOURCE 1: Backend KV store =====
      let backendOrders: Order[] = [];
      let backendAvailable = false;
      
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/orders`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          backendOrders = data.orders || [];
          backendAvailable = true;
          setShowSetupBanner(false);
          console.log('✅ [OrdersPage] Backend returned', backendOrders.length, 'orders');
        } else {
          const errorText = await response.text().catch(() => '');
          console.warn('⚠️ [OrdersPage] Backend returned status', response.status);
          if (errorText.includes('relation') || errorText.includes('does not exist') || errorText.includes('kv_store_a67f0635')) {
            setShowSetupBanner(true);
          }
        }
      } catch (backendError: any) {
        console.warn('⚠️ [OrdersPage] Backend fetch failed:', backendError.message);
      }
      
      // ===== SOURCE 2: localStorage =====
      const localOrders = loadOrdersFromLocalStorage();
      console.log('📦 [OrdersPage] localStorage has', localOrders.length, 'orders');
      
      // ===== MERGE: Combine both sources, deduplicate by order ID =====
      const orderMap = new Map<string, Order>();
      
      // Backend orders take priority (they have server-side data)
      backendOrders.forEach((order: Order) => {
        if (order && order.id) {
          orderMap.set(order.id, order);
        }
      });
      
      // Add localStorage orders that aren't in backend
      const unsyncedOrders: Order[] = [];
      localOrders.forEach((order: Order) => {
        if (order && order.id && !orderMap.has(order.id)) {
          orderMap.set(order.id, order);
          unsyncedOrders.push(order);
        }
      });
      
      // ===== AUTO-SYNC: Push unsynced localStorage orders to backend =====
      if (backendAvailable && unsyncedOrders.length > 0) {
        console.log('🔄 [OrdersPage] Auto-syncing', unsyncedOrders.length, 'localStorage orders to backend...');
        
        for (const order of unsyncedOrders) {
          try {
            const syncResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/payment/create-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'apikey': publicAnonKey
                },
                body: JSON.stringify({
                  userId: order.user_id || 'guest',
                  userEmail: order.customer_email || '',
                  userName: order.customer_name || 'Guest',
                  orderId: order.id,
                  orderNumber: order.order_number,
                  trackingNumber: order.tracking_number || '',
                  amount: parseFloat(order.total_amount) || 0,
                  currency: order.currency || 'INR',
                  paymentMethod: order.payment_method || 'zoho_payments',
                  items: order.items || [],
                  subtotal: parseFloat(order.subtotal) || 0,
                  discount: parseFloat(order.discount) || 0,
                  tax: parseFloat(order.tax) || 0,
                  shippingAddress: order.shipping_address || null,
                  notes: order.notes || '',
                  tip: order.tip || 0,
                  shippingMethod: order.shipping_method || 'email'
                })
              }
            );
            
            if (syncResponse.ok) {
              console.log('✅ [OrdersPage] Synced order', order.order_number, 'to backend');
            }
          } catch (syncErr) {
            console.warn('⚠️ [OrdersPage] Failed to sync order', order.order_number);
          }
        }
        
        if (unsyncedOrders.length > 0) {
          toast.success(`Synced ${unsyncedOrders.length} local order(s) to database`);
        }
      }
      
      // ===== FINAL: Sort and set =====
      const mergedOrders = Array.from(orderMap.values());
      
      // Filter out deleted orders
      const deletedIds = getDeletedOrderIds();
      const activeOrders = mergedOrders.filter(order => !deletedIds.has(order.id));
      
      if (deletedIds.size > 0) {
        console.log(`🗑️ [OrdersPage] Filtered out ${deletedIds.size} deleted orders`);
      }
      
      const sortedOrders = activeOrders.sort((a: Order, b: Order) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setOrders(sortedOrders);
      console.log('✅ [OrdersPage] Total orders displayed:', sortedOrders.length, 
        `(${backendOrders.length} backend + ${unsyncedOrders.length} local-only)`);
      
    } catch (error: any) {
      console.error('❌ [OrdersPage] Critical error fetching orders:', error);
      
      // Last resort: try localStorage only
      const localOrders = loadOrdersFromLocalStorage();
      if (localOrders.length > 0) {
        const sortedOrders = localOrders.sort((a: Order, b: Order) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setOrders(sortedOrders);
        toast.info('Showing orders from browser cache', { duration: 3000 });
      } else {
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  };

  const deleteSelectedOrders = async () => {
    if (!user) {
      toast.error('Authentication required. Please log in as admin.');
      return;
    }

    if (selectedOrders.size === 0) {
      toast.error('Please select orders to delete');
      return;
    }

    const count = selectedOrders.size;
    if (!confirm(`Are you sure you want to delete ${count} order(s)? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    
    try {
      console.log(`🗑️ [OrdersPage] Deleting ${count} selected orders...`);
      console.log('🔐 [Delete] User:', user.email);
      
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // DEMO ENVIRONMENT: Delete from localStorage only
      // This avoids JWT authentication issues in the demo environment
      console.log('🎭 [Delete] Demo environment - deleting from localStorage only');
      
      const deletedIds: string[] = [];
      
      for (const orderId of Array.from(selectedOrders)) {
        try {
          removeOrderFromLocalStorage(orderId);
          deletedIds.push(orderId);
          successCount++;
          console.log(`✅ [OrdersPage] Deleted order from localStorage: ${orderId}`);
        } catch (error: any) {
          failCount++;
          const errorMsg = error.message || String(error);
          console.error(`❌ [OrdersPage] Error deleting order ${orderId}:`, error);
          errors.push(`Order ${orderId.substring(0, 8)}: ${errorMsg}`);
        }
      }
      
      // Show success message
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} order(s)`, { duration: 4000 });
      }
      
      if (failCount > 0) {
        const errorDetails = errors.length > 0 ? `\n\nDetails:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''}` : '';
        toast.error(`Failed to delete ${failCount} order(s)${errorDetails}`, { duration: 5000 });
        console.error('🔍 [Delete] All errors:', errors);
      }

      // Clear selection
      setSelectedOrders(new Set());
      
      // Update local state immediately - remove deleted orders from the orders array
      setOrders(prevOrders => prevOrders.filter(order => !deletedIds.includes(order.id)));
      
      console.log(`✅ [OrdersPage] Removed ${deletedIds.length} orders from display`);
      
    } catch (error) {
      console.error('❌ [OrdersPage] Delete error:', error);
      toast.error('Failed to delete orders: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          toast.success('Copied to clipboard');
        })
        .catch(() => {
          // Fallback to execCommand
          fallbackCopyTextToClipboard(text);
        });
    } else {
      // Use fallback for browsers without Clipboard API
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success('Copied to clipboard');
      } else {
        toast.error('Failed to copy');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'processing': 'bg-blue-100 text-blue-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800',
      'closed': 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentDots = (paymentStatus: string) => {
    return (
      <div className="flex gap-1">
        <div className={`w-2 h-2 rounded-full ${paymentStatus === 'paid' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      </div>
    );
  };

  const getShippedDots = (status: string) => {
    const shipped = ['shipped', 'delivered'].includes(status.toLowerCase());
    return (
      <div className="flex gap-1">
        <div className={`w-2 h-2 rounded-full ${shipped ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      </div>
    );
  };

  const getRefundDots = () => {
    return (
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
      </div>
    );
  };

  const downloadInvoice = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      console.log('📄 [OrdersPage] Generating invoice PDF for order:', order.order_number);
      
      // Generate and download invoice PDF
      await generateInvoicePDF(order);
      
      toast.success('Invoice PDF downloaded successfully');
      console.log('✅ [OrdersPage] Invoice PDF downloaded:', order.order_number);
    } catch (error) {
      console.error('❌ [OrdersPage] Failed to download invoice PDF:', error);
      toast.error('Failed to generate invoice PDF');
    }
  };

  const filteredOrders = filterStatus === 'All' 
    ? orders 
    : orders.filter(order => order.status.toLowerCase() === filterStatus.toLowerCase());

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">All Sales Orders</h1>
              <button className="text-gray-500 hover:text-gray-700">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchOrders();
                  toast.success('Refreshing orders...');
                }}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Refresh orders"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {selectedOrders.size > 0 && (
                <button
                  onClick={deleteSelectedOrders}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={`Delete ${selectedOrders.size} selected order(s)`}
                >
                  <Trash2 className={`w-4 h-4 ${deleting ? 'animate-spin' : ''}`} />
                  Delete Selected ({selectedOrders.size})
                </button>
              )}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="p-1.5 hover:bg-gray-100 rounded">
                <span className="text-gray-600"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Setup Banner - shown when database table might be missing */}
        {showSetupBanner && orders.length === 0 && (
          <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Database Setup Required
                </h3>
                <p className="text-yellow-800 text-sm mb-4">
                  Orders cannot be displayed because the database table is not set up. Click the button below to set up the database and start seeing customer orders in the admin panel.
                </p>
                <button
                  onClick={() => navigate('/admin/orders-setup')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors inline-flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Set Up Database
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300"
                    checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Sales Order#
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Order Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Shipped
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Refund
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => navigate(`/admin/sales/orders/${order.id}`)}
                >
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium hover:text-blue-800">
                        {order.order_number}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(order.order_number);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {/* Show paperclip icon if order has uploaded files */}
                      {order.items.some(item => {
                        const files = item.uploadedFiles || (item.uploadedFile ? [item.uploadedFile] : []);
                        return files.some(f => f.hasFile || f.data);
                      }) && (
                        <Paperclip className="w-3.5 h-3.5 text-blue-500" title="Order has uploaded files" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer_name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.customer_email || ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getPaymentDots(order.payment_status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getShippedDots(order.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getRefundDots()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {order.currency === 'INR' ? '₹' : '$'}{parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => downloadInvoice(order, e)}
                        className="p-1.5 hover:bg-blue-50 rounded transition-colors group"
                        title="Download Invoice"
                      >
                        <FileText className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/sales/orders/${order.id}`);
                        }}
                        className="p-1.5 hover:bg-purple-50 rounded transition-colors group"
                        title="View Shipment"
                      >
                        <Truck className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/sales/orders/${order.id}`);
                        }}
                        className="p-1.5 hover:bg-green-50 rounded transition-colors group"
                        title="View Payment"
                      >
                        <CreditCard className="w-4 h-4 text-green-600 group-hover:text-green-700" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No orders found</p>
              {filterStatus !== 'All' && (
                <button
                  onClick={() => setFilterStatus('All')}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredOrders.length} of {orders.length} orders
              {selectedOrders.size > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({selectedOrders.size} selected)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <span className="text-sm text-gray-600">1 / 1</span>
              <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default OrdersPage;

// Function to load orders from both localStorage sources
function loadOrdersFromLocalStorage(): Order[] {
  const allOrders: Order[] = [];
  const orderMap = new Map<string, Order>();
  
  // Load from admin storage
  const adminStored = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (adminStored) {
    try {
      const adminOrders = JSON.parse(adminStored);
      adminOrders.forEach((order: Order) => {
        orderMap.set(order.id, order);
      });
    } catch (e) {
      console.error('❌ [OrdersPage] Failed to parse admin localStorage:', e);
    }
  }
  
  // Load from user storage  
  const userStored = localStorage.getItem('user_orders');
  if (userStored) {
    try {
      const userOrders = JSON.parse(userStored);
      userOrders.forEach((order: Order) => {
        // Only add if not already in map (admin storage takes precedence)
        if (!orderMap.has(order.id)) {
          orderMap.set(order.id, order);
        }
      });
    } catch (e) {
      console.error('❌ [OrdersPage] Failed to parse user localStorage:', e);
    }
  }
  
  return Array.from(orderMap.values());
}

// Function to remove an order from localStorage
function removeOrderFromLocalStorage(orderId: string) {
  // Remove from admin storage
  const adminStored = localStorage.getItem(ORDERS_STORAGE_KEY);
  if (adminStored) {
    try {
      const adminOrders = JSON.parse(adminStored);
      const updatedOrders = adminOrders.filter((order: Order) => order.id !== orderId);
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updatedOrders));
    } catch (e) {
      console.error('❌ [OrdersPage] Failed to remove order from admin localStorage:', e);
    }
  }
  
  // Remove from user storage
  const userStored = localStorage.getItem('user_orders');
  if (userStored) {
    try {
      const userOrders = JSON.parse(userStored);
      const updatedOrders = userOrders.filter((order: Order) => order.id !== orderId);
      localStorage.setItem('user_orders', JSON.stringify(updatedOrders));
    } catch (e) {
      console.error('❌ [OrdersPage] Failed to remove order from user localStorage:', e);
    }
  }
  
  // Add to deleted orders list (persistent tracking)
  try {
    const deletedStored = localStorage.getItem(DELETED_ORDERS_KEY);
    const deletedIds: string[] = deletedStored ? JSON.parse(deletedStored) : [];
    if (!deletedIds.includes(orderId)) {
      deletedIds.push(orderId);
      localStorage.setItem(DELETED_ORDERS_KEY, JSON.stringify(deletedIds));
      console.log(`✅ [OrdersPage] Added ${orderId} to deleted orders list`);
    }
  } catch (e) {
    console.error('❌ [OrdersPage] Failed to update deleted orders list:', e);
  }
}

// Function to get list of deleted order IDs
function getDeletedOrderIds(): Set<string> {
  try {
    const deletedStored = localStorage.getItem(DELETED_ORDERS_KEY);
    if (deletedStored) {
      const deletedIds: string[] = JSON.parse(deletedStored);
      return new Set(deletedIds);
    }
  } catch (e) {
    console.error('❌ [OrdersPage] Failed to load deleted orders list:', e);
  }
  return new Set();
}