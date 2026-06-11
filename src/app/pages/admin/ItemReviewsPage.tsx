import { useState, useEffect } from 'react';
import { AdminLayout } from '@/app/components/admin/AdminLayout';
import { Star, Check, X, Eye, EyeOff, Search, Filter, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { projectId, publicAnonKey } from '@/app/utils/backendInfo';

interface Review {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  reviewText: string;
  date: string;
  status: 'approved' | 'pending' | 'hidden';
  verifiedBuyer?: boolean;
}

const REVIEWS_STORAGE_KEY = 'local_reviews';

export function ItemReviewsPage() {
  const { accessToken } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'hidden'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load reviews from backend or localStorage
  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      console.log('📦 [ItemReviewsPage] Loading reviews...');
      
      // Try to fetch from backend first (only if using real auth, not mock)
      if (accessToken && !accessToken.startsWith('mock-token-')) {
        try {
          const response = await fetch(
            `https://${projectId}.authClient.co/functions/v1/make-server-a67f0635/admin/reviews`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const backendReviews = data.reviews || [];
            
            // Transform backend reviews to admin format
            const formattedReviews = backendReviews.map((review: any) => ({
              id: review.id,
              productId: review.productId,
              productName: review.productName,
              customerName: review.customerName,
              rating: review.rating,
              reviewText: review.reviewText,
              date: review.createdAt || review.updatedAt || new Date().toISOString(),
              status: review.status || 'approved',
              verifiedBuyer: review.verifiedBuyer || false
            }));
            
            setReviews(formattedReviews);
            console.log('✅ [ItemReviewsPage] Loaded', formattedReviews.length, 'reviews from backend');
            setLoading(false);
            return;
          } else if (response.status === 401) {
            console.log('⚠️ [ItemReviewsPage] Not authenticated, using localStorage');
          } else {
            console.log('⚠️ [ItemReviewsPage] Backend fetch failed, falling back to localStorage');
          }
        } catch (backendError) {
          console.log('⚠️ [ItemReviewsPage] Backend error, falling back to localStorage');
        }
      }
      
      // Fallback to localStorage (for mock auth or if backend fails)
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (stored) {
        const allReviews = JSON.parse(stored);
        // Transform the review format to match admin interface
        const formattedReviews = allReviews.map((review: any) => ({
          id: review.id,
          productId: review.productId,
          productName: review.productName,
          customerName: review.customerName,
          rating: review.rating,
          reviewText: review.reviewText,
          date: review.createdAt || review.updatedAt || new Date().toISOString(),
          status: review.status || 'approved',
          verifiedBuyer: review.verifiedBuyer || false
        }));
        setReviews(formattedReviews);
        console.log('✅ [ItemReviewsPage] Loaded', formattedReviews.length, 'reviews from localStorage');
      } else {
        setReviews([]);
        console.log('⚠️ [ItemReviewsPage] No reviews found in localStorage');
      }
    } catch (error) {
      console.error('❌ [ItemReviewsPage] Error loading reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const saveReviews = (updatedReviews: Review[]) => {
    try {
      // Get existing reviews from localStorage to preserve all fields
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      const existingReviews = stored ? JSON.parse(stored) : [];
      
      // Create a map of updated reviews by ID for quick lookup
      const updatedMap = new Map(updatedReviews.map(r => [r.id, r]));
      
      // Create a set of existing review IDs
      const existingIds = new Set(existingReviews.map((r: any) => r.id));
      
      // Update existing reviews while preserving all original fields
      const mergedReviews = existingReviews.map((existingReview: any) => {
        const updated = updatedMap.get(existingReview.id);
        if (updated) {
          // Merge: keep all original fields but update status and updatedAt
          return {
            ...existingReview,
            status: updated.status,
            rating: updated.rating,
            reviewText: updated.reviewText,
            updatedAt: new Date().toISOString()
          };
        }
        return existingReview;
      });
      
      // Add any new reviews that don't exist in localStorage yet
      updatedReviews.forEach(review => {
        if (!existingIds.has(review.id)) {
          // New review - add with full structure
          mergedReviews.push({
            id: review.id,
            productId: review.productId,
            productName: review.productName,
            userId: 'admin-added',
            customerName: review.customerName,
            rating: review.rating,
            reviewText: review.reviewText,
            status: review.status,
            verifiedBuyer: review.verifiedBuyer || false,
            helpfulVotes: 0,
            notHelpfulVotes: 0,
            voters: [],
            edited: false,
            createdAt: review.date,
            updatedAt: new Date().toISOString()
          });
        }
      });
      
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(mergedReviews));
      setReviews(updatedReviews);
      console.log('✅ [ItemReviewsPage] Saved', updatedReviews.length, 'reviews to localStorage');
    } catch (error) {
      console.error('❌ [ItemReviewsPage] Error saving reviews:', error);
    }
  };

  const handleApprove = async (reviewId: string) => {
    const updatedReviews = reviews.map(review => 
      review.id === reviewId ? { ...review, status: 'approved' as const } : review
    );
    
    // Update backend if using real auth
    if (accessToken) {
      try {
        const isMock = accessToken.startsWith('mock-token-');
        const bearerToken = isMock ? publicAnonKey : accessToken;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
        };
        
        const response = await fetch(
          `https://${projectId}.authClient.co/functions/v1/make-server-a67f0635/admin/reviews/${reviewId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'approved' })
          }
        );
        
        if (response.ok) {
          console.log('✅ [ItemReviewsPage] Review approved on backend');
        }
      } catch (error) {
        console.error('❌ [ItemReviewsPage] Error updating backend:', error);
      }
    }
    
    saveReviews(updatedReviews);
  };

  const handleHide = async (reviewId: string) => {
    const updatedReviews = reviews.map(review => 
      review.id === reviewId ? { ...review, status: 'hidden' as const } : review
    );
    
    // Update backend
    if (accessToken) {
      try {
        const isMock = accessToken.startsWith('mock-token-');
        const bearerToken = isMock ? publicAnonKey : accessToken;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
        };
        
        const response = await fetch(
          `https://${projectId}.authClient.co/functions/v1/make-server-a67f0635/admin/reviews/${reviewId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'hidden' })
          }
        );
        
        if (response.ok) {
          console.log('✅ [ItemReviewsPage] Review hidden on backend');
        }
      } catch (error) {
        console.error('❌ [ItemReviewsPage] Error updating backend:', error);
      }
    }
    
    saveReviews(updatedReviews);
  };

  const handleShow = async (reviewId: string) => {
    const updatedReviews = reviews.map(review => 
      review.id === reviewId ? { ...review, status: 'approved' as const } : review
    );
    
    // Update backend
    if (accessToken) {
      try {
        const isMock = accessToken.startsWith('mock-token-');
        const bearerToken = isMock ? publicAnonKey : accessToken;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
        };
        
        const response = await fetch(
          `https://${projectId}.authClient.co/functions/v1/make-server-a67f0635/admin/reviews/${reviewId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ status: 'approved' })
          }
        );
        
        if (response.ok) {
          console.log('✅ [ItemReviewsPage] Review shown on backend');
        }
      } catch (error) {
        console.error('❌ [ItemReviewsPage] Error updating backend:', error);
      }
    }
    
    saveReviews(updatedReviews);
  };

  const handleDelete = async (reviewId: string, customerName: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the review by ${customerName}?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) {
      return;
    }
    
    console.log('🗑️ [ItemReviewsPage] Deleting review:', reviewId);
    
    // Delete from backend if using real auth
    if (accessToken && !accessToken.startsWith('mock-token-')) {
      try {
        const response = await fetch(
          `https://${projectId}.authClient.co/functions/v1/make-server-a67f0635/admin/reviews/${reviewId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          console.log('✅ [ItemReviewsPage] Review deleted from backend');
        } else {
          console.log('⚠️ [ItemReviewsPage] Backend delete failed, removing from localStorage only');
        }
      } catch (error) {
        console.error('❌ [ItemReviewsPage] Error deleting from backend:', error);
      }
    }
    
    // Remove from localStorage
    try {
      const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (stored) {
        const allReviews = JSON.parse(stored);
        const filteredReviews = allReviews.filter((r: any) => r.id !== reviewId);
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(filteredReviews));
        console.log('✅ [ItemReviewsPage] Review deleted from localStorage');
      }
    } catch (error) {
      console.error('❌ [ItemReviewsPage] Error deleting from localStorage:', error);
    }
    
    // Update UI
    const updatedReviews = reviews.filter(review => review.id !== reviewId);
    setReviews(updatedReviews);
  };

  const filteredReviews = reviews.filter(review => {
    const matchesStatus = filterStatus === 'all' || review.status === filterStatus;
    const matchesSearch = review.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         review.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         review.reviewText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: reviews.length,
    approved: reviews.filter(r => r.status === 'approved').length,
    pending: reviews.filter(r => r.status === 'pending').length,
    hidden: reviews.filter(r => r.status === 'hidden').length,
    averageRating: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      hidden: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Item Reviews</h1>
          <p className="text-gray-600 mt-1">Manage customer feedback and ratings for your services</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Reviews</h3>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Approved</h3>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Hidden</h3>
            <p className="text-3xl font-bold text-red-600">{stats.hidden}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Rating</h3>
     
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, product, or review text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Filter className="w-5 h-5 text-gray-400 my-auto" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {filteredReviews.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No reviews found matching your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredReviews.map((review) => (
                <div key={review.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{review.customerName}</h3>
                        {getStatusBadge(review.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{review.productName}</p>
                      <div className="flex items-center gap-3">
                        {renderStars(review.rating)}
                        <span className="text-sm text-gray-500">
                          {new Date(review.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {review.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(review.id)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                          title="Approve Review"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}
                      {review.status === 'hidden' ? (
                        <button
                          onClick={() => handleShow(review.id)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Show Review"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHide(review.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Hide Review"
                        >
                          <EyeOff className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(review.id, review.customerName)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        title="Delete Review"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Review Text */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 italic">"{review.reviewText}"</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}