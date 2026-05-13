import { motion } from 'motion/react';
import { CheckCircle, Star } from 'lucide-react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import translationImage from 'figma:asset/932f33a08fc9b252330c11c14559a461e76f7fd3.png';

export function HeroSection() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    navigate(path);
  };

  return (
    <section className="relative bg-gradient-to-br from-[#b8d4e8] via-[#c5ddf0] to-[#a8c9e0] overflow-hidden pt-6 pb-16 lg:pt-10 lg:pb-24">
      {/* Animated Background Text */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        {/* First row moving right */}
        <motion.div
          className="absolute top-[10%] left-0 whitespace-nowrap text-[120px] font-bold text-[#0a1247]"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ 
            duration: 40, 
            repeat: Infinity, 
            ease: 'linear',
            repeatType: 'loop'
          }}
        >
          TRANSLATION • APOSTILLE • ATTESTATION • CERTIFIED •
        </motion.div>
        
        {/* Second row moving left */}
        <motion.div
          className="absolute top-[35%] right-0 whitespace-nowrap text-[100px] font-bold text-[#0a1247]"
          animate={{ x: ['100%', '-100%'] }}
          transition={{ 
            duration: 45, 
            repeat: Infinity, 
            ease: 'linear',
            repeatType: 'loop'
          }}
        >
          LANGUAGE • PROFESSIONAL • ACCURATE • RELIABLE •
        </motion.div>
        
        {/* Third row moving right */}
        <motion.div
          className="absolute top-[60%] left-0 whitespace-nowrap text-[110px] font-bold text-[#0a1247]"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ 
            duration: 50, 
            repeat: Infinity, 
            ease: 'linear',
            repeatType: 'loop'
          }}
        >
          ISO CERTIFIED • FAST SERVICE • 50+ LANGUAGES •
        </motion.div>
        
        {/* Fourth row moving left */}
        <motion.div
          className="absolute top-[85%] right-0 whitespace-nowrap text-[95px] font-bold text-[#0a1247]"
          animate={{ x: ['100%', '-100%'] }}
          transition={{ 
            duration: 42, 
            repeat: Infinity, 
            ease: 'linear',
            repeatType: 'loop'
          }}
        >
          GLOBAL • TRUSTED • EXPERT • QUALITY •
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Image with smooth animation */}
          <div className="relative">
            <img
              src={translationImage}
              alt="Translation Services"
              className="w-full max-w-md mx-auto"
              style={{
                mixBlendMode: 'multiply'
              }}
            />
          </div>

          {/* Right: Text content with staggered animation */}
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            className="text-gray-900 space-y-8"
          >
            <motion.h1 
              className="text-4xl lg:text-5xl font-bold text-[#0a1247]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Certified Document
            </motion.h1>

            <motion.h2 
              className="text-3xl lg:text-4xl leading-snug text-[#0a1247] font-semibold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              Break Language Barriers with<br />
              <span className="text-[#0a1247]">Professional Translation Services</span>
            </motion.h2>

            <motion.p 
              className="text-xl text-gray-700 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              From English to any foreign language, we deliver fast, accurate,
              and reliable translations for businesses and individuals.
            </motion.p>

            <motion.button 
              onClick={() => handleNavigate('/all-translation-products')}
              className="group bg-[#0a1247] text-white px-10 py-4 rounded-full font-bold hover:bg-[#1a2457] transition-all mt-6 shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform flex items-center gap-3 animate-blink"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <Upload className="w-5 h-5" />
              Upload Document
            </motion.button>

            <motion.div 
              className="flex items-center gap-8 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-900">50+</div>
                <div className="text-sm text-gray-700">Languages</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-900">24/7</div>
                <div className="text-sm text-gray-700">Support</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-900">ISO</div>
                <div className="text-sm text-gray-700">Certified</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent"></div>
    </section>
  );
}
