export function TranslatorExperience() {
  // Helper function to extract video ID from YouTube URL or return ID if already extracted
  const extractVideoId = (url: string): string => {
    // If it's already just an ID (no slashes or special chars), return it
    if (!url.includes('/') && !url.includes('?')) {
      return url;
    }
    
    // Extract from youtu.be format: https://youtu.be/VIDEO_ID?si=...
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1].split('?')[0];
      return id;
    }
    
    // Extract from youtube.com format: https://www.youtube.com/watch?v=VIDEO_ID
    if (url.includes('watch?v=')) {
      const id = url.split('watch?v=')[1].split('&')[0];
      return id;
    }
    
    return url;
  };

  // Add your YouTube video URLs or IDs here
  // You can paste full YouTube links or just the video IDs
  const videos = [
    'https://youtu.be/WN6rFWYseNI?si=GIXs0RHKjCm5fexD',
    'https://youtu.be/4RvUxV2hjyI?si=C1YEfMYdVWnuO85m',
    'https://youtu.be/667EkeEaFmw?si=UvN13CsZhMGpa00f',
    'https://youtu.be/qhNdikINxZE?si=7h6orTKP-0tgrFoR',
  ];

  return (
    <section className="py-8 md:py-10 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">
          Translator Experience
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {videos.map((video, index) => {
            const videoId = extractVideoId(video);
            return (
              <div key={index} className="aspect-video rounded-lg overflow-hidden shadow-lg">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={`Translator Experience ${index + 1}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
