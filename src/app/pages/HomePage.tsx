import { HeroSection } from '@/app/components/home/HeroSection';
import { CompanyLogosSlider } from '@/app/components/home/CompanyLogosSlider';
import { TrustIndexReviewsSection } from '@/app/components/home/TrustIndexReviewsSection';
import { ISOCertificationSection } from '@/app/components/home/ISOCertificationSection';
import { TranslatorExperience } from '@/app/components/home/TranslatorExperience';
import { PickYourLanguage } from '@/app/components/home/PickYourLanguage';
import { Testimonials } from '@/app/components/home/Testimonials';

function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <CompanyLogosSlider />
      <TrustIndexReviewsSection />
      <ISOCertificationSection />
      <TranslatorExperience />
      <PickYourLanguage />
      <Testimonials />
    </div>
  );
}

export default HomePage;
