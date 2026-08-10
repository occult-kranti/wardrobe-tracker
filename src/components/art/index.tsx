export function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Hanger silhouette */}
      <path
        d="M24 4C20.5 4 18 6.5 18 9.5C18 11.2 18.8 12.7 20 13.6L8 24C7.5 24.4 7.5 25.2 8 25.6L10 27.2C10.5 27.6 11.2 27.4 11.5 26.9L14 23V42C14 43.1 14.9 44 16 44H32C33.1 44 34 43.1 34 42V23L36.5 26.9C36.8 27.4 37.5 27.6 38 27.2L40 25.6C40.5 25.2 40.5 24.4 40 24L28 13.6C29.2 12.7 30 11.2 30 9.5C30 6.5 27.5 4 24 4ZM24 7C25.7 7 27 8.3 27 10C27 11.3 26.1 12.4 24.9 12.8L24 12L23.1 12.8C21.9 12.4 21 11.3 21 10C21 8.3 22.3 7 24 7Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Decorative arc */}
      <path
        d="M24 2C28.5 2 32 5.5 32 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

export function EmptyClosetArt({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Wardrobe frame */}
      <rect x="40" y="30" width="120" height="150" rx="4" stroke="#C9A86C" strokeWidth="1.5" opacity="0.3" />
      <line x1="100" y1="30" x2="100" y2="180" stroke="#C9A86C" strokeWidth="1" opacity="0.2" />
      {/* Hangers */}
      <path d="M55 55 L55 45 L60 40 L70 40 L75 45 L75 55" stroke="#C9A86C" strokeWidth="1" opacity="0.5" fill="none" />
      <path d="M85 55 L85 45 L90 40 L100 40 L105 45 L105 55" stroke="#C9A86C" strokeWidth="1" opacity="0.5" fill="none" />
      <path d="M115 55 L115 45 L120 40 L130 40 L135 45 L135 55" stroke="#C9A86C" strokeWidth="1" opacity="0.5" fill="none" />
      {/* Clothing silhouettes */}
      <path d="M50 55 L50 120 Q65 125 80 120 L80 55" stroke="#8B7347" strokeWidth="1" opacity="0.3" fill="none" />
      <path d="M90 55 L90 110 Q100 115 110 110 L110 55" stroke="#8B7347" strokeWidth="1" opacity="0.25" fill="none" />
      <path d="M120 55 L120 130 Q135 135 150 130 L150 55" stroke="#8B7347" strokeWidth="1" opacity="0.3" fill="none" />
      {/* Bottom drawers */}
      <rect x="45" y="140" width="50" height="35" rx="2" stroke="#C9A86C" strokeWidth="1" opacity="0.2" fill="none" />
      <rect x="105" y="140" width="50" height="35" rx="2" stroke="#C9A86C" strokeWidth="1" opacity="0.2" fill="none" />
      {/* Sparkles */}
      <path d="M160 60 L162 65 L167 67 L162 69 L160 74 L158 69 L153 67 L158 65 Z" fill="#C9A86C" opacity="0.4" />
      <path d="M30 100 L31.5 103 L34.5 104 L31.5 105 L30 108 L28.5 105 L25.5 104 L28.5 103 Z" fill="#C9A86C" opacity="0.3" />
    </svg>
  );
}

export function EmptyOutfitArt({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Circular frame */}
      <circle cx="100" cy="100" r="70" stroke="#C9A86C" strokeWidth="1" opacity="0.2" strokeDasharray="4 4" />
      {/* Central figure - abstract fashion form */}
      <path
        d="M85 50 Q100 45 115 50 Q120 70 115 90 Q110 110 115 130 Q120 150 110 160 L100 165 L90 160 Q80 150 85 130 Q90 110 85 90 Q80 70 85 50Z"
        stroke="#C9A86C"
        strokeWidth="1.5"
        opacity="0.4"
        fill="none"
      />
      {/* Neckline */}
      <path d="M92 55 Q100 60 108 55" stroke="#C9A86C" strokeWidth="1" opacity="0.3" fill="none" />
      {/* Decorative lines - representing layers */}
      <path d="M75 80 Q100 85 125 80" stroke="#8B7347" strokeWidth="1" opacity="0.3" fill="none" />
      <path d="M78 105 Q100 110 122 105" stroke="#8B7347" strokeWidth="1" opacity="0.3" fill="none" />
      <path d="M82 130 Q100 135 118 130" stroke="#8B7347" strokeWidth="1" opacity="0.3" fill="none" />
      {/* Sparkles */}
      <circle cx="155" cy="60" r="2" fill="#C9A86C" opacity="0.5" />
      <circle cx="45" cy="140" r="1.5" fill="#C9A86C" opacity="0.4" />
      <circle cx="165" cy="130" r="1" fill="#C9A86C" opacity="0.3" />
    </svg>
  );
}

export function EmptyWishlistArt({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Shopping bag */}
      <path
        d="M60 70 L60 160 Q60 170 70 170H130Q140 170 140 160L140 70Z"
        stroke="#C9A86C"
        strokeWidth="1.5"
        opacity="0.4"
        fill="none"
      />
      {/* Bag handles */}
      <path d="M75 70 Q75 45 85 40H115Q125 45 125 70" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" fill="none" />
      {/* Heart on bag */}
      <path
        d="M100 115 Q85 100 85 115Q85 130 100 140Q115 130 115 115Q115 100 100 115Z"
        stroke="#B06B7A"
        strokeWidth="1.5"
        opacity="0.5"
        fill="none"
      />
      {/* Decorative elements */}
      <circle cx="50" cy="90" r="3" stroke="#C9A86C" strokeWidth="1" opacity="0.3" fill="none" />
      <circle cx="150" cy="120" r="2.5" stroke="#C9A86C" strokeWidth="1" opacity="0.3" fill="none" />
      {/* Stars */}
      <path d="M155 55 L156.5 58.5 L160 59 L157.5 61.5 L158 65 L155 63 L152 65 L152.5 61.5 L150 59 L153.5 58.5 Z" fill="#C9A86C" opacity="0.3" />
    </svg>
  );
}

export function CalendarArt({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Calendar page */}
      <rect x="45" y="50" width="110" height="100" rx="4" stroke="#C9A86C" strokeWidth="1.5" opacity="0.3" fill="none" />
      {/* Calendar rings */}
      <line x1="65" y1="40" x2="65" y2="60" stroke="#C9A86C" strokeWidth="2" opacity="0.4" />
      <line x1="135" y1="40" x2="135" y2="60" stroke="#C9A86C" strokeWidth="2" opacity="0.4" />
      <circle cx="65" cy="40" r="4" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" fill="none" />
      <circle cx="135" cy="40" r="4" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" fill="none" />
      {/* Date grid lines */}
      <line x1="45" y1="80" x2="155" y2="80" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      <line x1="45" y1="105" x2="155" y2="105" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      <line x1="45" y1="130" x2="155" y2="130" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      <line x1="78" y1="80" x2="78" y2="150" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      <line x1="111" y1="80" x2="111" y2="150" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      <line x1="144" y1="80" x2="144" y2="150" stroke="#C9A86C" strokeWidth="0.5" opacity="0.2" />
      {/* Highlighted date */}
      <rect x="82" y="85" width="26" height="16" rx="2" fill="#C9A86C" opacity="0.15" />
      {/* Small hanger icon on calendar */}
      <path d="M95 120 L95 115 L97 113 L103 113 L105 115 L105 120" stroke="#8B7347" strokeWidth="1" opacity="0.4" fill="none" />
    </svg>
  );
}

export function StatsArt({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Abstract chart/compass hybrid */}
      <circle cx="100" cy="100" r="60" stroke="#C9A86C" strokeWidth="1" opacity="0.2" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="40" stroke="#C9A86C" strokeWidth="0.5" opacity="0.15" />
      {/* Compass needle / chart line */}
      <path d="M100 100 L100 50" stroke="#C9A86C" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
      <path d="M100 100 L130 115" stroke="#8B7347" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      <path d="M100 100 L70 120" stroke="#8B7347" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="100" cy="100" r="4" fill="#C9A86C" opacity="0.6" />
      {/* Decorative ticks */}
      <line x1="100" y1="35" x2="100" y2="42" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" />
      <line x1="100" y1="158" x2="100" y2="165" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" />
      <line x1="35" y1="100" x2="42" y2="100" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" />
      <line x1="158" y1="100" x2="165" y2="100" stroke="#C9A86C" strokeWidth="1.5" opacity="0.4" />
      {/* Sparkles */}
      <circle cx="145" cy="55" r="2" fill="#C9A86C" opacity="0.4" />
      <circle cx="55" cy="145" r="1.5" fill="#C9A86C" opacity="0.3" />
    </svg>
  );
}

export function DecorativeDivider({ className = "w-full h-px" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C9A86C30] to-transparent" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border border-[#C9A86C40]" />
    </div>
  );
}

export function OrnamentalCorner({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0 L20 0 Q0 0 0 20 Z" fill="#C9A86C" opacity="0.1" />
      <path d="M4 4 L14 4 Q4 4 4 14 Z" fill="#C9A86C" opacity="0.15" />
    </svg>
  );
}

export function BlobBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#C9A86C] opacity-[0.03] blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#8B3A3A] opacity-[0.03] blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C9A86C] opacity-[0.02] blur-3xl" />
    </div>
  );
}
