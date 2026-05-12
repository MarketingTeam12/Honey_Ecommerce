export function StartupPackages() {
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

  // Add your Startup Package YouTube video URLs or IDs here
  const videos = [
    'https://youtu.be/nVrSsvjJ1lg?si=xwKdwkgCbVaB2sOn', // Replace with your Basic Package video URL or ID
    'https://youtu.be/48XaA1Rglu0?si=coAQXXo8Cc92V9qA', // Replace with your Standard Package video URL or ID
    'https://youtu.be/KoLFSkn2UIc?si=D9k6su5sgRKlPSyb', // Replace with your Premium Package video URL or ID
  ];

  const packageTitles = [
    'Basic Startup Package',
    'Standard Startup Package',
    'Premium Startup Package',
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
          Startup Packages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {videos.map((video, index) => {
            const videoId = extractVideoId(video);
            return (
              <div key={index} className="space-y-3">
                <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={packageTitles[index]}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
                <h3 className="text-center font-semibold text-gray-900">
                  {packageTitles[index]}
                </h3>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}