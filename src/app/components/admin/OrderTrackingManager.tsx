import React, { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  FileText,
  UserCheck,
  Edit3,
  Check,
  Mail,
  Truck,
  DollarSign,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';

interface TrackingStage {
  id: string;
  label: string;
  icon: any;
  completed: boolean;
  timestamp?: string;
  details?: string;
}

interface ActivityItem {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  type: 'status_update' | 'info' | 'alert';
}

interface OrderTracking {
  stages: {
    [key: string]: {
      completed: boolean;
      timestamp?: string;
      details?: string;
    };
  };
  translator?: {
    name: string;
    location: string;
  };
  activities: ActivityItem[];
}

interface OrderTrackingManagerProps {
  orderId: string;
  orderNumber: string;
  onUpdate?: () => void;
}

export function OrderTrackingManager({
  orderId,
  orderNumber,
  onUpdate,
}: OrderTrackingManagerProps) {
  const { accessToken } = useAuth();
  const [tracking, setTracking] = useState<OrderTracking>({
    stages: {},
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translatorName, setTranslatorName] = useState('');
  const [translatorLocation, setTranslatorLocation] = useState('');

  // Define the 12 sequential stages
  const stageDefinitions = [
    { id: 'received', label: 'Received', icon: Package },
    { id: 'payment_received', label: 'Payment Received', icon: DollarSign },
    { id: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { id: 'document_analysis', label: 'Document Analysis', icon: FileText },
    { id: 'translator_assigned', label: 'Translator Assigned', icon: UserCheck },
    { id: 'translator_working', label: 'Translator Working', icon: Edit3 },
    { id: 'formatting', label: 'Formatting', icon: Edit3 },
    { id: 'proof_checking', label: 'Proof Checking', icon: Check },
    { id: 'draft_ready', label: 'Draft Ready', icon: FileText },
    { id: 'soft_copy_ready', label: 'Soft Copy Ready', icon: Mail },
    { id: 'courier', label: 'Courier', icon: Package },
    { id: 'shipped', label: 'Shipped', icon: Truck },
  ];

  useEffect(() => {
    fetchTracking();
  }, [orderId]);

  const fetchTracking = async () => {
    try {
      setLoading(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/orders/${orderId}/tracking`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.order?.tracking) {
          setTracking(data.order.tracking);
          if (data.order.tracking.translator) {
            setTranslatorName(data.order.tracking.translator.name || '');
            setTranslatorLocation(data.order.tracking.translator.location || '');
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const isBackendIssue = errorData.code === 401 || 
                               errorData.message?.includes('Invalid JWT');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - tracking unavailable');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Tracking request timed out');
      } else {
        console.log('ℹ️ Error fetching tracking:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStage = async (stageId: string) => {
    const isCompleted = tracking.stages[stageId]?.completed || false;
    const newCompleted = !isCompleted;

    try {
      setSaving(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/orders/${orderId}/tracking/stage`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          },
          body: JSON.stringify({
            stageId,
            completed: newCompleted,
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        setTracking(data.tracking);
        toast.success(
          `Stage "${stageDefinitions.find((s) => s.id === stageId)?.label}" ${
            newCompleted ? 'completed' : 'unmarked'
          }`
        );
        onUpdate?.();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const isBackendIssue = errorData.code === 401 || 
                               errorData.message?.includes('Invalid JWT');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - stage updates unavailable');
          toast.error('Backend not deployed. Tracking updates require Supabase Edge Functions.');
        } else {
          console.log('ℹ️ Failed to update stage:', errorData);
          toast.error('Failed to update stage');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Stage update request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.log('ℹ️ Error updating stage:', error.message);
        toast.error('Failed to update tracking stage');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStageDetails = async (stageId: string, details: string) => {
    try {
      setSaving(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/orders/${orderId}/tracking/stage`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          },
          body: JSON.stringify({
            stageId,
            details,
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        setTracking(data.tracking);
        toast.success('Stage details updated');
        onUpdate?.();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const isBackendIssue = errorData.code === 401 || 
                               errorData.message?.includes('Invalid JWT');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - stage detail updates unavailable');
          toast.error('Backend not deployed. Stage updates require Supabase Edge Functions.');
        } else {
          console.log('ℹ️ Failed to update stage details:', errorData);
          toast.error('Failed to update stage details');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Stage details update request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.log('ℹ️ Error updating stage details:', error.message);
        toast.error('Failed to update stage details');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTranslator = async () => {
    if (!translatorName.trim()) {
      toast.error('Translator name is required');
      return;
    }

    try {
      setSaving(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/orders/${orderId}/tracking/translator`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          },
          body: JSON.stringify({
            name: translatorName.trim(),
            location: translatorLocation.trim(),
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        setTracking(data.tracking);
        toast.success('Translator information updated');
        onUpdate?.();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const isBackendIssue = errorData.code === 401 || 
                               errorData.message?.includes('Invalid JWT');
        
        if (isBackendIssue) {
          console.log('ℹ️ Backend not deployed - translator updates unavailable');
          toast.error('Backend not deployed. Translator updates require Supabase Edge Functions.');
        } else {
          console.log('ℹ️ Failed to update translator:', errorData);
          toast.error('Failed to update translator');
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('ℹ️ Translator update request timed out');
        toast.error('Request timed out. Please try again.');
      } else {
        console.log('ℹ️ Error updating translator information:', error.message);
        toast.error('Failed to update translator information');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0a1247] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Order Tracking Manager</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage real-time tracking stages for order #{orderNumber}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-semibold text-green-700">LIVE TRACKING</span>
        </div>
      </div>

      {/* Translator Assignment */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Translator Assignment</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Translator Name *
            </label>
            <input
              type="text"
              value={translatorName}
              onChange={(e) => setTranslatorName(e.target.value)}
              placeholder="e.g., Deepa"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={translatorLocation}
              onChange={(e) => setTranslatorLocation(e.target.value)}
              placeholder="e.g., Bangalore"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <button
          onClick={handleUpdateTranslator}
          disabled={saving || !translatorName.trim()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Update Translator Info
        </button>
      </div>

      {/* Tracking Stages */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Tracking Stages</h4>
        <div className="space-y-3">
          {stageDefinitions.map((stageDef, index) => {
            const Icon = stageDef.icon;
            const stageData = tracking.stages[stageDef.id];
            const isCompleted = stageData?.completed || false;
            const details = stageData?.details || '';
            const timestamp = stageData?.timestamp;

            return (
              <div
                key={stageDef.id}
                className={`border-2 rounded-xl p-4 transition-all ${
                  isCompleted
                    ? 'border-[#10B981] bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p
                          className={`font-semibold ${
                            isCompleted ? 'text-[#10B981]' : 'text-gray-900'
                          }`}
                        >
                          {index + 1}. {stageDef.label}
                        </p>
                        {timestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            Completed:{' '}
                            {new Date(timestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleStage(stageDef.id)}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          isCompleted
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                      </button>
                    </div>

                    {/* Details Input */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Stage Details (optional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={details}
                          onChange={(e) => {
                            const newTracking = { ...tracking };
                            if (!newTracking.stages[stageDef.id]) {
                              newTracking.stages[stageDef.id] = {
                                completed: false,
                              };
                            }
                            newTracking.stages[stageDef.id].details = e.target.value;
                            setTracking(newTracking);
                          }}
                          placeholder="e.g., In progress, Expected completion: 2 hours"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleUpdateStageDetails(stageDef.id, details)}
                          disabled={saving}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Changes made here will reflect instantly on the customer's
          live tracking dashboard. The customer will see real-time updates with timestamps
          and activity feed updates.
        </p>
      </div>
    </div>
  );
}