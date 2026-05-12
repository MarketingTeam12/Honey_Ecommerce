import { useState, useEffect } from 'react';
import { AdminLayout } from '@/app/components/admin/AdminLayout';
import { useNavigate } from 'react-router';
import { User, Mail, Phone, Eye, MoreVertical, Search, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

const ORDERS_STORAGE_KEY = 'honey_translation_orders';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  status: 'active' | 'inactive';
  currency: string;
}

function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = () => {
    try {
      setLoading(true);
      
      // Load orders from localStorage
      const storedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (storedOrders) {
        const orders = JSON.parse(storedOrders);
        
        // Group orders by customer email
        const customerMap = new Map<string, Customer>();
        
        orders.forEach((order: any) => {
          const email = order.customer_email || 'unknown@example.com';
          
          if (customerMap.has(email)) {
            const customer = customerMap.get(email)!;
            customer.totalOrders += 1;
            customer.totalSpent += parseFloat(order.total_amount);
            
            // Update last order date if this order is more recent
            if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
              customer.lastOrderDate = order.created_at;
            }
          } else {
            customerMap.set(email, {
              id: order.user_id || `customer-${Date.now()}`,
              name: order.customer_name || 'Unknown Customer',
              email: email,
              phone: order.shipping_address?.phone || undefined,
              totalOrders: 1,
              totalSpent: parseFloat(order.total_amount),
              lastOrderDate: order.created_at,
              status: 'active',
              currency: order.currency || 'INR'
            });
          }
        });
        
        // Convert map to array and sort by total spent (descending)
        const customerList = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
        
        // Mark customers as inactive if last order was more than 90 days ago
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        customerList.forEach(customer => {
          if (new Date(customer.lastOrderDate) < ninetyDaysAgo) {
            customer.status = 'inactive';
          }
        });
        
        setCustomers(customerList);
        console.log('✅ [CustomersPage] Loaded', customerList.length, 'customers');
      } else {
        setCustomers([]);
        console.log('⚠️ [CustomersPage] No orders found in localStorage');
      }
    } catch (error) {
      console.error('❌ [CustomersPage] Error loading customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'All' || 
      customer.status.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading customers...</p>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and view all your customers
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers by name, email, or ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Customers</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-6 border-b border-gray-200">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Customers</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{customers.length}</p>
              </div>
              <User className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active Customers</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {customers.filter(c => c.status === 'active').length}
                </p>
              </div>
              <User className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {customers.reduce((sum, c) => sum + c.totalOrders, 0)}
                </p>
              </div>
              <User className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  ₹{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <User className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Total Orders
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Last Order Date
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr 
                  key={customer.id} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500">ID: {customer.id.substring(0, 12)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {customer.email}
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {customer.phone}
                        </div>
                      )}
                      {!customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Phone className="w-4 h-4 text-gray-300" />
                          No phone
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {customer.totalOrders}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {customer.currency === 'INR' ? '₹' : '$'}
                      {customer.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {new Date(customer.lastOrderDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          // Navigate to orders filtered by customer
                          navigate(`/admin/sales/orders?customer=${customer.email}`);
                        }}
                        className="p-1.5 hover:bg-blue-50 rounded transition-colors group"
                        title="View Orders"
                      >
                        <Eye className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                      </button>
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors group"
                        title="More Options"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-600 group-hover:text-gray-700" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery || filterStatus !== 'All' 
                  ? 'No customers found matching your criteria' 
                  : 'No customers yet'}
              </p>
              {(searchQuery || filterStatus !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('All');
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {filteredCustomers.length} of {customers.length} customers
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

export default CustomersPage;