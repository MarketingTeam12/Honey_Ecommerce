import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Badge } from '@/app/components/ui/badge';
import { useCurrency } from '@/app/context/CurrencyContext';
import { useProducts } from '@/app/context/ProductContext';
import englishToForeignImg from 'figma:asset/ed7cdf787729d6d1793cb1a6b477c320f0fcadeb.png';
import englishToIndianImg from 'figma:asset/5d3738f42d25760a7464ddc4a8fe45a029b7fbfb.png';
import indianToEnglishImg from 'figma:asset/cef973a78471dbf5787d64535927f3ed4d791b1e.png';
import { getFirstValidImage } from '@/app/utils/imageUtils';

export function PickYourLanguage() {
  const { convertPrice } = useCurrency();
  const { products: adminProducts } = useProducts();

  // Get Translation category products from admin (exclude sworn translations)
  const translationProducts = adminProducts.filter(
    product => product.category === 'Translation' && 
               product.status === 'active' &&
               !product.name.toLowerCase().includes('sworn')
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
      tag: 'BEST OFFER',
      route: '/english-to-foreign-language',
      image: englishToForeignImg,
    },
    {
      id: '2',
      title: 'English to Any Indian Language',
      offerPrice: 400,
      originalPrice: 2000,
      tag: 'BEST OFFER',
      route: '/english-to-any-indian-language',
      image: englishToIndianImg,
    },
    {
      id: '3',
      title: 'Any Indian Language to English',
      offerPrice: 400,
      originalPrice: 2000,
      tag: 'BEST OFFER',
      route: '/any-indian-language-to-english',
      image: indianToEnglishImg,
    },
    {
      id: '4',
      title: 'Foreign Language to English',
      offerPrice: 800,
      originalPrice: 2000,
      tag: 'BEST OFFER',
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
        tag: 'BEST OFFER',
        route: `/product/${product.id}`,
        image: getFirstValidImage(product.images),
        icon: '📄'
      }))
    : fallbackProducts;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <motion.h2
          className="text-4xl lg:text-5xl font-bold text-center text-gray-900 mb-12"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Pick Your Language
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                className="group block"
              >
                <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-blue-600 hover:shadow-2xl transition-all mb-4">
                  <div className="relative w-full h-72 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-contain object-top transform group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-7xl">{product.icon}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Below Box */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {product.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-red-600">
                      {convertPrice(product.offerPrice)}
                    </p>
                    <p className="text-sm text-gray-500 line-through">
                      {convertPrice(product.originalPrice)}
                    </p>
                  </div>
                  {product.tag && (
                    <Badge className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white">
                      {product.tag}
                    </Badge>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
