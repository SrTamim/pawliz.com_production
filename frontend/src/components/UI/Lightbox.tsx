import { useState, useEffect, useRef } from 'react';

export default function Lightbox({ images = [], initialIndex = 0, isOpen, onClose }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const imgRef = useRef<any>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: any) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isOpen, onClose]);

  const goToNext = () => {
    setCurrentIndex((i: any) => (i + 1) % images.length);
  };

  const goToPrev = () => {
    setCurrentIndex((i: any) => (i - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: any) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: any) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
    setTouchStart(null);
  };

  if (!isOpen || !images.length) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e: any) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(0,0,0,0.6)',
          border: 'none',
          color: 'white',
          fontSize: 24,
          cursor: 'pointer',
          minWidth: 44,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          zIndex: 2,
        }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Main image container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        onClick={(e: any) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imgRef}
          src={currentImage}
          alt={`Image ${currentIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            cursor: isZoomed ? 'zoom-out' : 'zoom-in',
            transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
            transition: 'transform 0.2s ease-out',
          }}
          onClick={() => setIsZoomed(!isZoomed)}
          onDoubleClick={() => setIsZoomed(!isZoomed)}
        />

        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                fontSize: 24,
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={goToNext}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                fontSize: 24,
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Counter + Thumbnail strip */}
      {images.length > 1 && (
        <>
          {/* Counter */}
          <div
            style={{
              position: 'absolute',
              bottom: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {currentIndex + 1} / {images.length}
          </div>

          {/* Thumbnail strip */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 8,
              maxWidth: '80vw',
              overflowX: 'auto',
              padding: '0 8px',
            }}
          >
            {images.map((img: any, i: any) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  border: i === currentIndex ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                  background: 'transparent',
                }}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
