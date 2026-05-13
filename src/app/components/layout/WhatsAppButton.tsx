import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const phoneNumber = '+917299005577';
  const message = 'Hello! I need help with translation services.';

  const handleClick = () => {
    window.open(
      `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-24 right-4 w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-colors flex items-center justify-center z-50"
      aria-label="Contact on WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
