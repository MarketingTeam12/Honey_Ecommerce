import { useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { Check, Upload, MessageCircle, Minus, Plus, Heart, ShoppingCart as ShoppingCartIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useCurrency } from '@/app/context/CurrencyContext';
import { useCart } from '@/app/context/CartContext';
import { useWishlist } from '@/app/context/WishlistContext';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';
import googlePayIcon from 'figma:asset/02347af70453dbcedcb242f3af1712a1a954b2f1.png';
import mastercardIcon from 'figma:asset/23e6e86ee8f55bfcbc0611bfe54a4aa7beca2f55.png';
import paypalIcon from 'figma:asset/44e11688213a30c41ad3fe8aae7def63b605380d.png';
import rupayIcon from 'figma:asset/81733917598b7aad94b96ac30b5e2f8a5f8dab91.png';
import visaIcon from 'figma:asset/6f49b2a01cfe14370d80bfa5aa6e2cb4c045e327.png';
import whatsappIcon from 'figma:asset/a7133ddeef3c5e583ad7afec517e13c693256fa0.png';
import { Trash2 } from 'lucide-react';

// Sworn Translation Pricing Data
const SWORN_TRANSLATION_DATA: Record<string, { originalPrice: number; offerPrice: number; label: string }> = {
  'english-to-spanish': { originalPrice: 5000, offerPrice: 3299, label: 'English to Spanish Sworn Translation' },
  'english-to-german': { originalPrice: 5000, offerPrice: 4299, label: 'English to German Sworn Translation' },
  'english-to-italian': { originalPrice: 3000, offerPrice: 1499, label: 'English to Italian Sworn Translation' },
  'english-to-french': { originalPrice: 5000, offerPrice: 3300, label: 'English to French Sworn Translation' },
};

const DOCUMENT_TYPES = [
  'Birth Certificate',
  'Marriage Certificate',
  'Academic Certificate',
  'Academic Marksheet',
  'Police Clearance Certificate (PCC)',
  'Divorce Decree',
  'Ration Card',
  'Court Papers',
  'Medical Certificate',
  'Driving License',
];

export function SwornTranslationPage() {
  const { language } = useParams<{ language: string }>();
  const navigate = useNavigate();
  const { convertPrice, currency } = useCurrency();
  const { addToCart } = useCart();
  const { addToWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quantity, setQuantity] = useState(1);
  const [documentType, setDocumentType] = useState('');
  const [numberOfPages, setNumberOfPages] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const data = SWORN_TRANSLATION_DATA[language || 'english-to-spanish'];
  const staticRating = useMemo(() => {
    const seed = language || 'english-to-spanish';
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 2 === 0 ? 5 : 4;
  }, [language]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Service Not Found</h1>
          <Link to="/" className="text-blue-600 hover:underline">Return to Home</Link>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      e.target.value = '';
    }
  };

  const handleAddToCart = () => {
    if (!user) {
      toast.error('Please log in to add items to your cart.');
      return;
    }
    if (!documentType) {
      toast.error('Please select a document type.');
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error('Please upload at least one document.');
      return;
    }
    addToCart({
      id: `sworn-translation-${language}`,
      name: data.label,
      basePrice: data.offerPrice,
      totalPrice: data.offerPrice * numberOfPages,
      category: 'sworn-translation',
      url: window.location.pathname,
      image: 'https://images.unsplash.com/photo-1577345848762-8b7cab61de4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
      uploadedDocument: uploadedFiles[0] || null,
      uploadedDocuments: uploadedFiles,
      pageCount: numberOfPages,
      certificateType: documentType,
    });
    navigate('/cart');
  };

  const handleAddToWishlist = () => {
    if (!user) {
      toast.error('Please log in to add items to your wishlist.');
      return;
    }
    addToWishlist({
      id: `sworn-translation-${language}`,
      name: data.label,
      price: data.offerPrice,
      imageUrl: 'https://images.unsplash.com/photo-1577345848762-8b7cab61de4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link to="/" className="text-gray-600 hover:text-blue-600">Home</Link>
          <span className="text-gray-400">/</span>
          <Link to="/sworn-translations" className="text-gray-600 hover:text-blue-600">Sworn Translation</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900">{data.label}</span>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* LEFT COLUMN - Product Image */}
          <div className="space-y-4">
            <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
              <img
                src="https://images.unsplash.com/photo-1577345848762-8b7cab61de4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                alt={data.label}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* RIGHT COLUMN - Product Details */}
          <div className="space-y-6">
            {/* Product Title with Wishlist Button */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 flex-1">
                  {data.label}
                </h1>
                
                {/* Wishlist Heart Button */}
                <button
                  onClick={handleAddToWishlist}
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md hover:shadow-lg ${
                    isInWishlist(`sworn-translation-${language}`)
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-white text-gray-600 border-2 border-gray-300 hover:bg-red-500 hover:text-white hover:border-red-500'
                  }`}
                  aria-label={isInWishlist(`sworn-translation-${language}`) ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    className="w-6 h-6"
                    fill={isInWishlist(`sworn-translation-${language}`) ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              
              {/* Non-Returnable Badge */}
              <Badge variant="destructive" className="mb-4">
                NON-RETURNABLE
              </Badge>
            </div>

            {/* Price Section */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-sm text-gray-500">Original Price:</span>
                <span className="text-xl text-gray-500 line-through">
                  {convertPrice(data.originalPrice)}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-sm text-gray-700 font-medium">Offer Price:</span>
                <span className="text-3xl font-bold text-red-600">
                  {convertPrice(data.offerPrice)}
                </span>
              </div>
              <Badge className="bg-red-600 hover:bg-red-700 text-white">
                BEST OFFER
              </Badge>
            </div>

            {/* Product Highlights */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">The pricing shown is applicable per page – please update the page count as needed for accurate billing.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Once the sworn translation is completed, scanned copies are emailed to you before the hard copies are dispatched.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Hard copies are delivered throughout India and internationally.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Recognized globally for visa, immigration, embassy, legal, academic, and official use.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Includes a duly signed and stamped sworn translation on the company's official letterhead, along with a Sworn Affidavit / Certificate of Translation verifying accuracy.</span>
              </div>
            </div>

            {/* Quick Support */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-gray-700 mb-2">
                For any queries or quick support, contact us via WhatsApp.
              </p>
              <a
                href="https://wa.me/917299005577"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
              >
                <MessageCircle className="w-5 h-5" />
                Chat on WhatsApp
              </a>
            </div>

            {/* Secure Checkout Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-3">
                Secure checkout with your preferred payment option.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-3 py-1.5 rounded text-xs font-bold">Razorpay</span>
                <span className="text-gray-400">•</span>
                <img src={googlePayIcon} alt="Google Pay" className="h-10" />
                <span className="text-gray-400">•</span>
                <img src={mastercardIcon} alt="Mastercard" className="h-10" />
                <span className="text-gray-400">•</span>
                <img src={paypalIcon} alt="PayPal" className="h-10" />
                <span className="text-gray-400">•</span>
                <img src={rupayIcon} alt="RuPay" className="h-10" />
                <span className="text-gray-400">•</span>
                <img src={visaIcon} alt="Visa" className="h-10" />
              </div>
            </div>

            {/* Social Share Section */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Share this product</h3>
              <div className="flex items-center gap-3">
                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
                  aria-label="Share on Facebook"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>

                {/* Twitter/X */}
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(data.label)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
                  aria-label="Share on Twitter"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-blue-700 hover:bg-blue-800 flex items-center justify-center transition-colors"
                  aria-label="Share on LinkedIn"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>

                {/* Pinterest */}
                <a
                  href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&description=${encodeURIComponent(data.label)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
                  aria-label="Share on Pinterest"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                  </svg>
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(data.label + ' - ' + window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center transition-colors"
                  aria-label="Share on WhatsApp"
                >
                  <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Documents Accepted Section */}
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Documents Accepted</h3>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_TYPES.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2 text-gray-700 text-sm">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            {/* Document Type Selection */}
            <div className="border-t pt-6">
              <Label htmlFor="document-type" className="font-semibold mb-3 block">
                Select Document Type
              </Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div>
              <Label className="font-semibold mb-3 block">
                Upload Documents <span className="text-red-600">*</span>
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-500">Recommended file size: maximum 7 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</p>
                  <ul className="space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-center justify-between gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span>{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Total Number of Pages */}
            <div>
              <Label htmlFor="pages" className="font-semibold mb-3 block">
                Total no. of pages: {numberOfPages}
              </Label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setNumberOfPages(Math.max(1, numberOfPages - 1))}
                  className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <input
                  type="number"
                  value={numberOfPages}
                  onChange={(e) => setNumberOfPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center border-2 border-gray-300 rounded-lg py-2 text-lg font-semibold"
                  min="1"
                />
                <button
                  onClick={() => setNumberOfPages(numberOfPages + 1)}
                  className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleAddToCart}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
              >
                <ShoppingCartIcon className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
            </div>
          </div>
        </div>

        {/* Product Details Section */}
        <div className="mt-12 space-y-8">
          {/* What You Will Receive */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What You Will Receive</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-3">Official Sworn Translation</h3>
                <p className="text-gray-700 mb-2">Professionally prepared by an authorized/approved sworn translator, bearing:</p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Translator's official stamp</li>
                  <li>Authorized signature</li>
                  <li>Certification as required by the concerned authority/embassy/court</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-3">Translation on Official Letterhead</h3>
                <p className="text-gray-700">All translations are issued on the recognized letterhead of the approved translator or institution, ensuring full authenticity and international acceptance.</p>
              </div>

              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-3">Digital & Physical Copies</h3>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Scanned PDFs of the completed translation will be emailed.</li>
                  <li>Hard copies will be delivered to your address via courier.</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">Important Note on Page Count:</h4>
                <p className="text-gray-700">If your document contains apostille stickers or stamps on both sides, the front and back sides are counted as separate pages if both sides need translation. Therefore, one physical sheet may be counted as two pages for billing and translation.</p>
              </div>
            </div>
          </div>

          {/* Processing Time */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Time</h2>
            <p className="text-gray-700">For documents containing 1–6 pages, sworn translation takes <span className="font-bold">4–5 working days</span></p>
            <p className="text-sm text-gray-600 mt-2">(Excluding Sundays and public holidays)</p>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">How the Sworn Translation Process Works</h2>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">Place Your Order</h3>
                  <p className="text-gray-700">Submit your documents and complete the order to receive instant confirmation via email.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">We Begin Work Within 2 Hours</h3>
                  <p className="text-gray-700">The team typically starts processing within 2 working hours. If clarification is needed, we may contact you via email or phone.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">Translation by Authorized Sworn Translator</h3>
                  <p className="text-gray-700">Documents are assigned only to officially approved translators recognized by the relevant embassy, court, or government body.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Authenticity & Warranty */}
          <div className="bg-green-50 rounded-lg border-2 border-green-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Authenticity & Warranty</h2>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">All sworn translations are created exclusively by certified and government/embassy-approved translators.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">The translation will meet legal requirements of the concerned authority, language, and destination country.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Globally accepted for visa applications, immigration, legal cases, academic purposes, court submissions, and embassy use.</span>
              </div>
            </div>
          </div>

          {/* Language Not Listed */}
          <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Language Not Listed?</h2>
            <p className="text-gray-700 mb-4">If your required language pair is not available in the dropdown, simply email your document to:</p>
            <p className="text-lg font-bold text-blue-600 mb-4">saleteam@honeytranslations.com</p>
            <p className="text-gray-700">You'll receive a quick and accurate quote.</p>
          </div>

          {/* Support */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Support</h2>
            <p className="text-gray-700 mb-2">For questions, call/WhatsApp: <a href="tel:+917299005577" className="font-bold text-blue-600 hover:underline">+91 7299005577</a></p>
            <p className="text-gray-700">Visit: <a href="https://honeytranslations.com" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">honeytranslations.com</a></p>
          </div>

          {/* Ratings & Reviews */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Ratings & Reviews</h2>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl font-bold text-gray-900">{staticRating.toFixed(1)}</span>
              <span className="text-xl text-gray-600">/ 5</span>
            </div>
            <p className="text-gray-600 mb-4">Based on 100 reviews</p>
            <p className="text-gray-500">
              {staticRating === 5 ? '5 stars: 100% | 4 stars: 0%' : '5 stars: 0% | 4 stars: 100%'}
            </p>
            <p className="text-sm text-gray-500 mt-2">Only Verified Buyers can review.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwornTranslationPage;
