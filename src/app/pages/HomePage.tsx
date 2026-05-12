import { HeroSection } from '@/app/components/home/HeroSection';
import { CompanyLogosSlider } from '@/app/components/home/CompanyLogosSlider';
import { GoogleReviewsSection } from '@/app/components/home/GoogleReviewsSection';
import { ISOCertificationSection } from '@/app/components/home/ISOCertificationSection';
import { ProfessionalAgencySection } from '@/app/components/home/ProfessionalAgencySection';
import { TranslatorExperience } from '@/app/components/home/TranslatorExperience';
import { PickYourLanguage } from '@/app/components/home/PickYourLanguage';
import { BrandMessage } from '@/app/components/home/BrandMessage';
import { WhyChooseUs } from '@/app/components/home/WhyChooseUs';
import { ApostilleServices } from '@/app/components/home/ApostilleServices';
import { PickYourApostille } from '@/app/components/home/PickYourApostille';
import { CustomerReviews } from '@/app/components/home/CustomerReviews';
import { OurServices } from '@/app/components/home/OurServices';
import { SwornTranslation } from '@/app/components/home/SwornTranslation';
import { ChooseSwornTranslation } from '@/app/components/home/ChooseSwornTranslation';
import { StartupPackages } from '@/app/components/home/StartupPackages';
import { Testimonials } from '@/app/components/home/Testimonials';

function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <CompanyLogosSlider />
      <GoogleReviewsSection />
      <ISOCertificationSection />
      <ProfessionalAgencySection />
      <TranslatorExperience />
      <PickYourLanguage />
      <BrandMessage />
      <WhyChooseUs />
      <ApostilleServices />
      <PickYourApostille />
      <CustomerReviews />
      <OurServices />
      <SwornTranslation />
      <ChooseSwornTranslation />
      <StartupPackages />
      <Testimonials />
    </div>
  );
}

export default HomePage;