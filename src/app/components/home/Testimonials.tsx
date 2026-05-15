import { motion } from 'motion/react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import fratelliTestimonialLogo from '@/assets/fratelli-testimonial.jpg';
import tvsLogoClean from '@/assets/tvs-logo-clean.png';
import hpTestimonialLogo from '@/assets/hp-testimonial.jpeg';
import aachiTestimonialLogo from '@/assets/aachi-testimonial.png';
import arcTestimonialLogo from '@/assets/arc-testimonial.png';
import royalEnfieldTestimonialLogo from '@/assets/royal-enfield-testimonial.webp';
import brightLightSocietyLogo from '@/assets/bright-light-society-logo.png';
import dbsLogo from '@/assets/dbs-logo-fixed.png';
import identityLogo from '@/assets/identity-logo.png';
import lrkLogo from '@/assets/lrk-logo.jpg';
import muthootFinanceLogo from '@/assets/muthoot-finance-logo.webp';
import newIndiaLogo from '@/assets/new-india-logo.jpg';
import saintGobainLogo from '@/assets/saint-gobain-source.jpg';

export function Testimonials() {
  const testimonials = [
    { 
      company: 'Fratelli', 
      text: 'Honey Universal Digital\'s localization services helped us expand our reach in the Indian market. Their attention to detail and cultural sensitivity in translating our product documentation and marketing materials made a significant difference in customer engagement.',
      logoSrc: fratelliTestimonialLogo
    },
    { 
      company: 'TVS Motor Company Ltd', 
      text: 'Despite strong advertising efforts, we struggled to connect with rural customers. Honey Universal Digital helped us bridge this gap by localizing our campaigns in regional languages, significantly increasing our market impact and brand recognition across India.',
      logoSrc: tvsLogoClean
    },
    { 
      company: 'HP Valves & Fittings', 
      text: 'Our technical documentation required precise translation to maintain safety standards and accuracy. Honey Universal Digital delivered exceptional quality, ensuring our engineering specifications were perfectly communicated across different languages and markets.',
      logoSrc: hpTestimonialLogo
    },
    { 
      company: 'Aachi Masala Foods Pvt. Ltd', 
      text: 'With Honey Universal Digital\'s localization expertise, we successfully connected with spice lovers across regions, increasing sales and expanding our exports. Their strategic approach also helped us resolve controversies and reinforce our brand\'s credibility.',
      logoSrc: aachiTestimonialLogo
    },
    { 
      company: 'ARC International Fertility', 
      text: 'Communicating sensitive medical information requires utmost care and precision. Honey Universal Digital provided expert translation services that helped us reach diverse communities with empathy and accuracy, making our fertility services more accessible to everyone.',
      logoSrc: arcTestimonialLogo
    },
    { 
      company: 'Bright Light Society', 
      text: 'As a non-profit organization, clear communication is vital to our mission. Honey Universal Digital helped us translate our educational materials and outreach programs into multiple languages, significantly expanding our impact in underserved communities.',
      logoSrc: brightLightSocietyLogo
    },
    { 
      company: 'DBS', 
      text: 'Entering the Indian market required us to localize our banking services and communications. Honey Universal Digital\'s expertise in financial terminology and regulatory compliance made our expansion smooth and helped us build trust with local customers.',
      logoSrc: dbsLogo
    },
    { 
      company: 'Identity', 
      text: 'Our brand messaging needed to resonate across different cultural contexts. Honey Universal Digital delivered creative localization that maintained our brand identity while adapting perfectly to regional markets, helping us establish a strong presence across India.',
      logoSrc: identityLogo
    },
    { 
      company: 'LRK', 
      text: 'Precision in translation is critical for our industry. Honey Universal Digital provided accurate and timely translation services that helped us maintain quality standards and expand our business operations into new regions with confidence.',
      logoSrc: lrkLogo
    },
    { 
      company: 'Muthoot Finance', 
      text: 'Reaching customers in their native language is key to financial inclusion. Honey Universal Digital helped us translate our loan products and financial education materials, making our services more accessible and building stronger relationships with customers across India.',
      logoSrc: muthootFinanceLogo
    },
    { 
      company: 'The New India Assurance', 
      text: 'Honey Universal Digital helped us enhance customer confidence through expert translation and localization. Their work significantly boosted our sales and strengthened our reputation across India, making our services more accessible and trustworthy.',
      logoSrc: newIndiaLogo
    },
    { 
      company: 'Royal Enfield', 
      text: 'Honey Universal Digital played a crucial role in strengthening our market presence. Their strategic localization efforts helped transform Royal Enfield into a household name while preserving the brand\'s rich heritage and legacy.',
      logoSrc: royalEnfieldTestimonialLogo
    },
    { 
      company: 'Saint-Gobain', 
      text: 'As a global construction materials leader, we needed localization that maintained technical accuracy across languages. Honey Universal Digital delivered exceptional quality, helping us communicate complex building solutions to architects, contractors, and distributors throughout India.',
      logoSrc: saintGobainLogo
    },
  ];

  // Duplicate testimonials for seamless infinite scroll loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];
  const logoOnlyCompanies = new Set(testimonials.map((testimonial) => testimonial.company));
  const blendLogoCompanies = new Set(testimonials.map((testimonial) => testimonial.company));
  const extraLargeLogoCompanies = new Set(['Royal Enfield', 'Saint-Gobain']);

  return (
    <section className="py-8 md:py-10 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-blue-600 font-semibold text-lg mb-2">What Client Says?</h3>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">
            Our Testimonials
          </h2>
        </motion.div>

        {/* Continuous scrolling container */}
        <div className="relative">
          <div className="flex w-max animate-scroll-testimonials">
            {duplicatedTestimonials.map((testimonial, index) => (
              <div 
                key={`${testimonial.company}-${index}`}
                className="flex-shrink-0 mx-4"
                style={{ width: '400px' }}
              >
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow h-full">
                  <div className="w-44 h-28 mb-2 mx-auto flex items-center justify-center">
                    <ImageWithFallback
                      src={testimonial.logoSrc}
                      alt={testimonial.company}
                      className={`${extraLargeLogoCompanies.has(testimonial.company) ? 'w-52 h-36' : 'w-36 h-20'} ${blendLogoCompanies.has(testimonial.company) ? 'mix-blend-multiply' : ''} object-contain mx-auto`}
                    />
                  </div>
                  {!logoOnlyCompanies.has(testimonial.company) && (
                    <h3 className="text-2xl font-bold text-gray-900 text-center mb-1">{testimonial.company}</h3>
                  )}
                  <p className="text-gray-700 text-center italic leading-relaxed text-sm">"{testimonial.text}"</p>
                  <div className="flex justify-center gap-2 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-300 text-4xl drop-shadow-[0_0_8px_rgba(253,224,71,1)]">{'\u2605'}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scroll-testimonials {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }

        .animate-scroll-testimonials {
          animation: scroll-testimonials 42s linear infinite;
          will-change: transform;
        }

        .animate-scroll-testimonials:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

