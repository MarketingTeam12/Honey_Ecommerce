import { motion } from 'motion/react';
import bannerCertificateCustom from '@/assets/banner-certificate-custom.png';
import honeyFavicon from '@/assets/honey-favicon.ico';
import bannerBefore from '@/assets/banner-before.png';
import bannerAfter from '@/assets/banner-after.png';
import approveStamp from '@/assets/approve.png';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#c7dbea] via-[#bdd4e6] to-[#b4cde0] border-t-4 border-[#2d96d8] rounded-t-[22px] pt-3 pb-6 lg:pb-7 min-h-[calc(100vh-150px)] sm:min-h-[calc(100vh-120px)] flex items-start">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-20 -left-14 sm:-top-28 sm:-left-20 h-56 w-56 sm:h-80 sm:w-80 rounded-full bg-[#0a1247]/10 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-14 -right-8 sm:-bottom-24 sm:-right-12 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-[#2f77b7]/12 blur-3xl"
          animate={{ x: [0, -45, 0], y: [0, -25, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 left-1/2 h-48 w-48 sm:h-72 sm:w-72 -translate-x-1/2 rounded-full border border-[#0a1247]/15"
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="absolute inset-0 overflow-hidden opacity-[0.035]">
          <motion.div
            className="absolute top-[14%] left-0 whitespace-nowrap text-[56px] sm:text-[100px] font-black tracking-[0.14em] sm:tracking-[0.2em] text-[#0a1247]"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 42, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          >
            TRANSLATION * APOSTILLE * ATTESTATION * CERTIFIED *
          </motion.div>
          <motion.div
            className="absolute top-[62%] right-0 whitespace-nowrap text-[48px] sm:text-[90px] font-black tracking-[0.12em] sm:tracking-[0.18em] text-[#0a1247]"
            animate={{ x: ['100%', '-100%'] }}
            transition={{ duration: 46, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
          >
            GLOBAL * TRUSTED * LEGAL * PROFESSIONAL *
          </motion.div>
        </div>

        <motion.div
          className="absolute top-[24%] right-[5%] text-[28px] sm:text-[44px] lg:text-[64px] font-extrabold text-[#0a1247]/[0.04] leading-none"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          CERTIFIED
        </motion.div>
        <motion.div
          className="absolute bottom-[18%] left-[5%] text-[20px] sm:text-[28px] lg:text-[40px] font-extrabold text-[#0a1247]/[0.04] leading-none"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        >
          LEGAL TRANSLATION
        </motion.div>
      </div>

      <div className="max-w-[1500px] mx-auto px-3 sm:px-4 lg:px-6 relative z-10 w-full">
        <div className="mx-auto max-w-[1160px] flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="font-sans text-gray-900 space-y-2 lg:space-y-3 mb-2 sm:mb-3 lg:mb-4"
          >
            <motion.h1
              className="text-[1.35rem] sm:text-[1.95rem] lg:text-[2.6rem] font-bold text-[#0a1247] tracking-[0.01em] leading-[1.1] sm:leading-[1.05]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              CERTIFIED TRANSLATIONS
            </motion.h1>

            <motion.h2
              className="text-[0.98rem] sm:text-[1.25rem] lg:text-[1.85rem] leading-[1.2] sm:leading-[1.12] text-[#0a1247] font-medium tracking-[0.002em] px-1 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              Accepted for Visa, Immigration, Legal,
              Court & International Purposes
            </motion.h2>

            <div className="w-[125px] sm:w-[175px] h-[3px] bg-[#0a1247] mx-auto rounded-full mt-1 mb-1" />

            <motion.p
              className="text-[0.82rem] sm:text-[1.02rem] lg:text-[1.25rem] text-[#203247] max-w-4xl leading-[1.35] font-medium mx-auto px-1 sm:px-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Pan-India Online Service | Email Soft Copies | Free Hard Copy Delivery Across India.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
            className="relative w-full mt-2 sm:mt-3 lg:mt-4"
          >
            <div className="absolute -inset-2 rounded-[28px] bg-gradient-to-r from-white/50 via-[#cce2f2]/30 to-white/50 blur-xl" />
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-2.5 lg:gap-3.5 max-w-[96vw] sm:max-w-[90vw] lg:max-w-[760px] mx-auto items-stretch">
              <div className="relative bg-white rounded-2xl border-2 border-[#6f88a3] shadow-lg overflow-visible aspect-[3/4]">
                <img
                  src={bannerCertificateCustom}
                  alt="Certificate sample left"
                  className="w-full h-full object-contain object-top bg-white"
                />
                <div className="absolute top-[0.8%] left-[0.6%] w-[19%] h-[10.5%] bg-white rounded-md z-10" />
                <img
                  src={honeyFavicon}
                  alt="Certificate icon left"
                  className="absolute top-[1.6%] left-[1.6%] w-[7.8%] h-auto object-contain z-20"
                />
              </div>
              <div className="relative bg-white rounded-2xl border-2 border-[#6f88a3] shadow-xl overflow-hidden aspect-[3/4] md:-translate-y-1">
                <img
                  src={bannerBefore}
                  alt="Certificate sample center"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-[0.8%] left-[0.8%] w-[20%] h-[9.5%] bg-white rounded-md z-10" />
                <img
                  src={honeyFavicon}
                  alt="Certificate icon center"
                  className="absolute top-[1.4%] left-[1.5%] w-[7.2%] h-auto object-contain z-20"
                />
              </div>
              <div className="relative bg-white rounded-2xl border-2 border-[#6f88a3] shadow-lg overflow-visible aspect-[3/4]">
                <img
                  src={bannerAfter}
                  alt="Certificate sample right"
                  className="w-full h-full object-contain object-top bg-white"
                />
                <div className="absolute top-[0.8%] left-[0.6%] w-[19%] h-[10.5%] bg-white rounded-md z-10" />
                <img
                  src={honeyFavicon}
                  alt="Certificate icon right"
                  className="absolute top-[1.6%] left-[1.6%] w-[7.8%] h-auto object-contain z-20"
                />
                <img
                  src={approveStamp}
                  alt="Approved stamp right"
                  className="absolute -right-[8%] top-[9%] w-[22%] h-auto object-contain z-30 rotate-[34deg]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-28 bg-gradient-to-t from-white/85 to-transparent" />
    </section>
  );
}

