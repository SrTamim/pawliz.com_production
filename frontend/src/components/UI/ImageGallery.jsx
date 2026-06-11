import { useState } from 'react';
import Lightbox from './Lightbox';

export default function ImageGallery({ images = [], maxDisplay = 4 }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images.length) {
    return (
      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: 48,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        No images available
      </div>
    );
  }

  const displayImages = images.slice(0, maxDisplay);
  const hasMore = images.length > maxDisplay;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8,
        }}
      >
        {displayImages.map((img, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              paddingBottom: '100%',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--bg-elevated)',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onClick={() => {
              setLightboxIndex(i);
              setLightboxOpen(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src={img}
              alt={`Gallery item ${i + 1}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ))}

        {hasMore && (
          <div
            style={{
              position: 'relative',
              paddingBottom: '100%',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'rgba(0,229,160,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s',
            }}
            onClick={() => {
              setLightboxIndex(maxDisplay);
              setLightboxOpen(true);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>
                {images.length - maxDisplay} more
              </div>
            </div>
          </div>
        )}
      </div>

      <Lightbox
        images={images}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
