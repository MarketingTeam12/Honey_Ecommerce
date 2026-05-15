import { Link } from 'react-router';
import { motion } from 'motion/react';
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
      icon: '🔄',
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
        icon: '📄'
      }))
    : fallbackProducts.filter(
        product => product.title.toLowerCase() !== blockedHomeProductName
      );

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {products.map((product, index) => (
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
                <div className="bg-white border-2 border-gray-300 rounded-3xl overflow-hidden shadow-md transition-all hover:border-blue-500 hover:shadow-2xl">
                  <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-7xl">{product.icon}</span>
                      </div>
                    )}
                  </div>

                  {/* Content Below Box */}
                  <div className="px-5 py-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-3">
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
                      <Badge className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm px-4 py-1.5 font-bold">
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
    </section>
  );
}
