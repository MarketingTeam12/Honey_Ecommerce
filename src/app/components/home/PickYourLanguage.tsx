import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { useCurrency } from '@/app/context/CurrencyContext';
import { useProducts } from '@/app/context/ProductContext';
import englishToForeignImg from 'figma:asset/ed7cdf787729d6d1793cb1a6b477c320f0fcadeb.png';
import englishToIndianImg from 'figma:asset/5d3738f42d25760a7464ddc4a8fe45a029b7fbfb.png';
import indianToEnglishImg from 'figma:asset/cef973a78471dbf5787d64535927f3ed4d791b1e.png';
import { getFirstValidImage } from '@/app/utils/imageUtils';

const PROMO_TAGS = ['Top Rated', 'Best Offer', 'Popular Choice', 'Exclusive Deal', 'Best Seller', 'Limited Time Offer'];

const getPromoTag = (seed: string) => {
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PROMO_TAGS[hash % PROMO_TAGS.length];
};

export function PickYourLanguage() {
  const { convertPrice } = useCurrency();
  const { products: adminProducts } = useProducts();
  const [startIndex, setStartIndex] = useState(0);
  const blockedHomeProductName = 'any language to any language';

  // Get Translation category products from admin (exclude sworn translations)
  const translationProducts = adminProducts.filter(
    product => product.category === 'Translation' && 
               product.status === 'active' &&
               !product.name.toLowerCase().includes('sworn') &&
               product.name.toLowerCase() !== blockedHomeProductName
  );

  // Debug logging
  console.log('PickYourLanguage - All admin products:', adminProducts);
  console.log('PickYourLanguage - Translation products:', translationProducts);

  // Fallback products if no admin products
  const fallbackProducts = [
    {
      id: '1',
      title: 'English to Foreign Language',
      offerPrice: 800,
      originalPrice: 2000,
      tag: getPromoTag('fallback-1'),
      route: '/english-to-foreign-language',
      image: englishToForeignImg,
    },
    {
      id: '2',
      title: 'English to Any Indian Language',
      offerPrice: 400,
      originalPrice: 2000,
      tag: getPromoTag('fallback-2'),
      route: '/english-to-any-indian-language',
      image: englishToIndianImg,
    },
    {
      id: '3',
      title: 'Any Indian Language to English',
      offerPrice: 400,
      originalPrice: 2000,
      tag: getPromoTag('fallback-3'),
      route: '/any-indian-language-to-english',
      image: indianToEnglishImg,
    },
    {
      id: '4',
      title: 'Foreign Language to English',
      offerPrice: 800,
      originalPrice: 2000,
      tag: getPromoTag('fallback-4'),
      route: '/foreign-language-to-english',
      icon: 'ðŸ”„',
    },
  ];

  // Use admin products if available, otherwise fallback
  const products = translationProducts.length > 0
    ? translationProducts.map(product => ({
        id: product.id,
        title: product.name,
        offerPrice: product.price,
        originalPrice: product.price * 2.5, // Calculate original price (2.5x offer)
        tag: getPromoTag(product.id),
        route: `/product/${product.id}`,
        image: getFirstValidImage(product.images),
        icon: 'ðŸ“„'
      }))
    : fallbackProducts.filter(
        product => product.title.toLowerCase() !== blockedHomeProductName
      );

  const visibleProducts = useMemo(() => {
    const visibleCount = 3;
    if (products.length <= visibleCount) return products;

    return Array.from({ length: visibleCount }, (_, offset) => {
      const productIndex = (startIndex + offset) % products.length;
      return products[productIndex];
    });
  }, [products, startIndex]);

  const goPrev = () => {
    if (products.length <= 3) return;
    setStartIndex(prev => (prev - 1 + products.length) % products.length);
  };

  const goNext = () => {
    if (products.length <= 3) return;
    setStartIndex(prev => (prev + 1) % products.length);
  };

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-8"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Pick Your Language
        </motion.h2>

        <div className="relative">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous language cards"
            className="hidden md:flex absolute -left-6 lg:-left-10 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-300 shadow-md hover:bg-gray-50"
          >
            <ChevronLeft className="h-6 w-6 text-gray-700" />
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next language cards"
            className="hidden md:flex absolute -right-6 lg:-right-10 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-300 shadow-md hover:bg-gray-50"
          >
            <ChevronRight className="h-6 w-6 text-gray-700" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {visibleProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {/* Image Box - Only contains image */}
              <Link
                to={product.route}
                className="group block h-full"
              >
                <div className="bg-white border-2 border-gray-300 rounded-2xl overflow-hidden shadow-md transition-all hover:border-blue-500 hover:shadow-2xl">
                  <div className="relative w-full aspect-[4/4.6] bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 overflow-hidden p-2">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-7xl">{product.icon}</span>
                      </div>
                    )}
                  </div>

                  {/* Content Below Box */}
                  <div className="px-4 py-4 space-y-3 min-h-[150px]">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug break-words line-clamp-2">
                      {product.title}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-2xl font-bold text-red-600">
                        {convertPrice(product.offerPrice)}
                      </p>
                      <p className="text-sm text-gray-500 line-through">
                        {convertPrice(product.originalPrice)}
                      </p>
                    </div>
                    {product.tag && (
                      <Badge className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs px-3 py-1.5 font-bold">
                        {product.tag}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

