import React from 'react';

export default function TikTokLogo({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src="/logo.png" 
      alt="Logo"
      className={className} 
      style={{ objectFit: 'contain', ...style }}
    />
  );
}
