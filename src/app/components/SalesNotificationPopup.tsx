import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { X, ShoppingBag } from 'lucide-react';
import { allProductsMap } from '@/app/data/allProductData';

interface SaleNotification {
  id: string;
  productName: string;
  description: string;
  location: string;
  thumbnail: string;
  productUrl: string;
}

export function SalesNotificationPopup() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Fetch actual product data from existing product pages
  const notifications: SaleNotification[] = [
    {
      id: '1',
      productName: allProductsMap['saudi-arabia'].title,
      description: 'Educational certificate apostille',
      location: 'Mumbai, India',
      thumbnail: allProductsMap['saudi-arabia'].images[0].url,
      productUrl: '/apostille/saudi-arabia',
    },
    {
      id: '2',
      productName: allProductsMap['uae'].title,
      description: 'Marriage certificate apostille',
      location: 'Dubai, UAE',
      thumbnail: allProductsMap['uae'].images[0].url,
      productUrl: '/apostille/uae',
    },
    {
      id: '3',
      productName: allProductsMap['china'].title,
      description: 'Birth certificate attestation',
      location: 'Delhi, India',
      thumbnail: allProductsMap['china'].images[0].url,
      productUrl: '/attestation/china',
    },
    {
      id: '4',
      productName: allProductsMap['qatar'].title,
      description: 'Degree certificate attestation',
      location: 'Bangalore, India',
      thumbnail: allProductsMap['qatar'].images[0].url,
      productUrl: '/attestation/qatar',
    },
    {
      id: '5',
      productName: allProductsMap['basic'].title,
      description: 'Company registration package',
      location: 'Hyderabad, India',
      thumbnail: allProductsMap['basic'].images[0].url,
      productUrl: '/startup/basic',
    },
    {
      id: '6',
      productName: allProductsMap['usa'].title,
      description: 'Academic certificate apostille',
      location: 'Chennai, India',
      thumbnail: allProductsMap['usa'].images[0].url,
      productUrl: '/apostille/usa',
    },
  ];

  useEffect(() => {
    if (isDismissed) return;

    let showInterval: NodeJS.Timeout | null = null;
    let hideTimeout: NodeJS.Timeout | null = null;

    const startCycle = () => {
      showInterval = setInterval(() => {
        if (!document.hidden) {
          setIsVisible(true);

          hideTimeout = setTimeout(() => {
            setIsVisible(false);
          }, 4000);
        }
      }, 5000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (showInterval) {
          clearInterval(showInterval);
          showInterval = null;
        }
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        setIsVisible(false);
      } else {
        if (!showInterval) {
          startCycle();
        }
      }
    };

    // Show first notification immediately
    setIsVisible(true);
    const firstHideTimeout = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    startCycle();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (showInterval) {
        clearInterval(showInterval);
      }
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      clearTimeout(firstHideTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDismissed]);

  useEffect(() => {
    if (isDismissed) return;

    let rotateInterval: NodeJS.Timeout | null = null;

    const startRotation = () => {
      rotateInterval = setInterval(() => {
        if (!document.hidden) {
          setCurrentIndex((prev) => (prev + 1) % notifications.length);
        }
      }, 5000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rotateInterval) {
          clearInterval(rotateInterval);
          rotateInterval = null;
        }
      } else {
        if (!rotateInterval) {
          startRotation();
        }
      }
    };

    startRotation();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rotateInterval) {
        clearInterval(rotateInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDismissed, notifications.length]);

  const handleClick = () => {
    const notification = notifications[currentIndex];
    navigate(notification.productUrl);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    setIsDismissed(true);
  };

  if (isDismissed || !isVisible) return null;

  const currentNotification = notifications[currentIndex];

  return (
    <div
      className={`fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-6 sm:right-auto z-50 transition-all duration-500 ease-out ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : '-translate-x-full opacity-0'
      }`}
    >
      <div
        onClick={handleClick}
        className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300 max-w-sm w-full sm:w-auto"
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter') handleClick();
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={currentNotification.thumbnail}
                alt={currentNotification.productName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-4">
            {/* Badge */}
            <div className="flex items-center gap-1 mb-2">
              <ShoppingBag className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-600 uppercase tracking-wide">
                Recent Purchase
              </span>
            </div>

            {/* Product Name */}
            <h4 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">
              {currentNotification.productName}
            </h4>

            {/* Description */}
            <p className="text-xs text-gray-600 mb-2 line-clamp-1">
              {currentNotification.description}
            </p>

            {/* Location */}
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Purchased from {currentNotification.location}
            </p>

            {/* Time indicator */}
            <p className="text-xs text-gray-400 mt-2">
              Just now
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full animate-progress"
            style={{
              animation: 'progress 4s linear forwards',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        .animate-progress {
          width: 0%;
        }
      `}</style>
    </div>
  );
}
