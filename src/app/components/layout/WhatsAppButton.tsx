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
      className="fixed bottom-8 left-6 w-16 h-16 bg-green-500 text-white rounded-full shadow-2xl hover:bg-green-600 transition-all hover:scale-110 flex items-center justify-center z-50 animate-bounce"
      aria-label="Contact on WhatsApp"
    >
      <MessageCircle className="w-8 h-8" />
    </button>
  );
}
