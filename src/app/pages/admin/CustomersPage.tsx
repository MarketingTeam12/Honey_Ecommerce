import { useState, useEffect } from 'react';
import { AdminLayout } from '@/app/components/admin/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Eye, Search } from 'lucide-react';

const ORDERS_STORAGE_KEY = 'honey_translation_orders';
const USER_ROLES_STORAGE_KEY = 'honey_translation_user_roles';
const REGISTERED_USERS_STORAGE_KEY = 'registered_users';
const ROLES_STORAGE_KEY = 'honey_roles';
const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

type UserRole = string;
type CustomerStatus = 'active' | 'inactive';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  lastLoginAt?: string;
  status: CustomerStatus;
  role: UserRole;
  currency: string;
}

const normalizeRole = (role: unknown): UserRole => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return 'customer';
  if (value === 'sales manager' || value === 'manager') return 'sales_manager';
  return value.replace(/\s+/g, '_');
};

const builtinRoleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'customer', label: 'Customer' },
];

const getAvailableRoleOptions = (): { value: UserRole; label: string }[] => {
  const options = [...builtinRoleOptions];

  try {
    const raw = localStorage.getItem(ROLES_STORAGE_KEY);
    if (!raw) return options;

    const parsed = JSON.parse(raw) as Array<{ key?: string; name?: string }>;
    if (!Array.isArray(parsed)) return options;

    parsed.forEach((role) => {
      const value = normalizeRole(role.key || role.name);
      const label = role.name || value;
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label });
      }
    });
  } catch (error) {
    console.error('Failed to load custom roles:', error);
  }

  return options;
};

const statusOptions: { value: CustomerStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Disabled' },
];

const normalizeStatus = (status: unknown): CustomerStatus => {
  const value = String(status || '').trim().toLowerCase();
  return value === 'inactive' || value === 'disabled' ? 'inactive' : 'active';
};

function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [customerRoles, setCustomerRoles] = useState<Record<string, UserRole>>({});
  const [customerStatuses, setCustomerStatuses] = useState<Record<string, CustomerStatus>>({});
  const roleOptions = getAvailableRoleOptions();

  useEffect(() => {
    const savedRoles = localStorage.getItem(USER_ROLES_STORAGE_KEY);
    if (savedRoles) {
      try {
        const parsedRoles = JSON.parse(savedRoles);
        const normalizedRoles = Object.fromEntries(
          Object.entries(parsedRoles).map(([email, role]) => [normalizeEmail(email), normalizeRole(role)])
        ) as Record<string, UserRole>;
        setCustomerRoles(normalizedRoles);
      } catch (error) {
        console.error('Failed to parse saved user roles:', error);
      }
    }
    fetchCustomers();
  }, []);

  const handleRoleChange = (customerEmail: string, role: UserRole) => {
    const emailKey = normalizeEmail(customerEmail);
    const updatedRoles = {
      ...customerRoles,
      [emailKey]: role
    };
    setCustomerRoles(updatedRoles);
    localStorage.setItem(USER_ROLES_STORAGE_KEY, JSON.stringify(updatedRoles));

    try {
      const registeredUsersStr = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
      const registeredUsers = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
      const updatedRegisteredUsers = registeredUsers.map((user: any) =>
        normalizeEmail(user.email) === emailKey
          ? { ...user, email: emailKey, role, updatedAt: new Date().toISOString() }
          : user
      );
      localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(updatedRegisteredUsers));

      const mockUserStr = localStorage.getItem('mock_user');
      if (mockUserStr) {
        const mockUser = JSON.parse(mockUserStr);
        if (normalizeEmail(mockUser?.email) === emailKey) {
          localStorage.setItem('mock_user', JSON.stringify({ ...mockUser, email: emailKey, role }));
        }
      }
    } catch (error) {
      console.error('Failed to persist role change:', error);
    }
  };

  const handleStatusChange = (customerEmail: string, status: CustomerStatus) => {
    const emailKey = normalizeEmail(customerEmail);
    const updatedStatuses = {
      ...customerStatuses,
      [emailKey]: status
    };
    setCustomerStatuses(updatedStatuses);

    setCustomers((prev) =>
      prev.map((customer) =>
        customer.email === emailKey ? { ...customer, status } : customer
      )
    );

    try {
      const registeredUsersStr = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
      const registeredUsers = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
      const updatedRegisteredUsers = registeredUsers.map((user: any) =>
        normalizeEmail(user.email) === emailKey
          ? { ...user, email: emailKey, status, updatedAt: new Date().toISOString() }
          : user
      );
      localStorage.setItem(REGISTERED_USERS_STORAGE_KEY, JSON.stringify(updatedRegisteredUsers));
    } catch (error) {
      console.error('Failed to persist status change:', error);
    }
  };

  const fetchCustomers = () => {
    try {
      setLoading(true);

      const customerMap = new Map<string, Customer>();
      const roleOverridesRaw = localStorage.getItem(USER_ROLES_STORAGE_KEY);
      const roleOverrides = roleOverridesRaw
        ? Object.fromEntries(
            Object.entries(JSON.parse(roleOverridesRaw)).map(([email, role]) => [normalizeEmail(email), normalizeRole(role)])
          )
        : {};

      const registeredUsersRaw = localStorage.getItem(REGISTERED_USERS_STORAGE_KEY);
      const registeredUsers = registeredUsersRaw ? JSON.parse(registeredUsersRaw) : [];

      registeredUsers.forEach((registeredUser: any) => {
        const email = normalizeEmail(registeredUser.email) || 'unknown@example.com';
        const existing = customerMap.get(email);
        const resolvedRole = normalizeRole(roleOverrides[email] ?? registeredUser.role);
        const lastLoginAt = registeredUser.lastLoginAt || registeredUser.updatedAt || registeredUser.createdAt || '';
        const resolvedStatus = normalizeStatus(registeredUser.status);

        customerMap.set(email, {
          id: existing?.id || registeredUser.id || `customer-${email}`,
          name: registeredUser.name || existing?.name || 'Unknown Customer',
          email,
          phone: registeredUser.phone || existing?.phone || undefined,
          totalOrders: existing?.totalOrders || 0,
          totalSpent: existing?.totalSpent || 0,
          lastOrderDate: existing?.lastOrderDate || lastLoginAt || registeredUser.createdAt || new Date().toISOString(),
          lastLoginAt: lastLoginAt || existing?.lastLoginAt,
          status: existing?.status || resolvedStatus,
          role: resolvedRole,
          currency: existing?.currency || registeredUser.currency || 'INR',
        });
      });

      const storedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (storedOrders) {
        const orders = JSON.parse(storedOrders);

        orders.forEach((order: any) => {
          const email = order.customer_email || 'unknown@example.com';
          const emailKey = normalizeEmail(email) || 'unknown@example.com';
          const existing = customerMap.get(emailKey);
          const orderDate = order.created_at || order.updated_at || new Date().toISOString();

          if (existing) {
            existing.totalOrders += 1;
            existing.totalSpent += parseFloat(order.total_amount || '0');
            if (new Date(orderDate) > new Date(existing.lastOrderDate)) {
              existing.lastOrderDate = orderDate;
            }
            existing.name = existing.name || order.customer_name || 'Unknown Customer';
            existing.phone = existing.phone || order.shipping_address?.phone || undefined;
            existing.currency = order.currency || existing.currency || 'INR';
            customerMap.set(emailKey, existing);
          } else {
            customerMap.set(emailKey, {
              id: order.user_id || `customer-${emailKey}`,
              name: order.customer_name || 'Unknown Customer',
              email: emailKey,
              phone: order.shipping_address?.phone || undefined,
              totalOrders: 1,
              totalSpent: parseFloat(order.total_amount || '0'),
              lastOrderDate: orderDate,
              lastLoginAt: undefined,
              status: 'active',
              role: normalizeRole(roleOverrides[emailKey] || 'customer'),
              currency: order.currency || 'INR',
            });
          }
        });
      }

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const customerList = Array.from(customerMap.values())
        .map((customer) => {
          const latestActivity = customer.lastOrderDate || customer.lastLoginAt || new Date().toISOString();
          const isInactiveByDate = new Date(latestActivity) < ninetyDaysAgo;
          const storedStatus = normalizeStatus(customer.status);
          const finalStatus: CustomerStatus = storedStatus === 'inactive' ? 'inactive' : (isInactiveByDate ? 'inactive' : 'active');

          return {
            ...customer,
            status: finalStatus,
          } as Customer;
        })
        .sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'active' ? -1 : 1;
          }

          return b.totalSpent - a.totalSpent;
        });

      setCustomers(customerList);
      setCustomerStatuses(
        Object.fromEntries(customerList.map((customer) => [customer.email, customer.status])) as Record<string, CustomerStatus>
      );
      console.log('✅ [CustomersPage] Loaded', customerList.length, 'customers');
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
            <p className="text-gray-600">Loading accounts...</p>
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
              <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and view all your accounts
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
                placeholder="Search accounts by name, email, or ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-6 border-b border-gray-200">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Accounts</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{customers.length}</p>
              </div>
              <User className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Active Accounts</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {customers.filter(c => c.status === 'active').length}
                </p>
              </div>
              <User className="w-10 h-10 text-green-600 opacity-50" />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Role
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
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={customerRoles[customer.email] || customer.role}
                      onChange={(e) => handleRoleChange(customer.email, e.target.value as UserRole)}
                      className="min-w-[140px] rounded-md border border-blue-500 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      customer.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <select
                        value={customerStatuses[customer.email] || customer.status}
                        onChange={(e) => handleStatusChange(customer.email, e.target.value as CustomerStatus)}
                        className="min-w-[120px] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
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
                  ? 'No accounts found matching your criteria' 
                  : 'No accounts yet'}
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
                  Showing {filteredCustomers.length} of {customers.length} accounts
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

