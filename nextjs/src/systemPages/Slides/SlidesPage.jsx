'use client';
import React, { useState, useEffect, useRef } from 'react';

const SLIDE_DURATION = 6000;
const LEADERBOARD_DURATION = 6000;

const SlidesPage = () => {
  const [showLeaderboard, setShowLeaderboard] = useState(true); // Start with leaderboard
  const [displayedImageUrl, setDisplayedImageUrl] = useState(null);
  const pendingImageUrl = useRef(null);
  const oldImageUrl = useRef(null);

  // Preload a new random slide image (returns the ready URL)
  const preloadNewSlide = async () => {
    try {
      const response = await fetch("/api/leaderboard/nextslide");
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Wait for the image to be fully loaded
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        
        return url;
      }
    } catch (error) {
      console.error('Failed to fetch slide:', error);
    }
    return null;
  };

  // Main cycle effect
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const runCycle = async () => {
      if (!isMounted) return;

      if (showLeaderboard) {
        // Currently showing leaderboard - preload the next image
        const readyImageUrl = await preloadNewSlide();
        
        if (!isMounted) {
          // Cleanup if unmounted during fetch
          if (readyImageUrl) URL.revokeObjectURL(readyImageUrl);
          return;
        }

        if (readyImageUrl) {
          // Store the pending image
          pendingImageUrl.current = readyImageUrl;
          
          // Wait for leaderboard duration, then switch to image
          timeoutId = setTimeout(() => {
            if (!isMounted) return;
            
            // Revoke old image URL
            if (oldImageUrl.current) {
              URL.revokeObjectURL(oldImageUrl.current);
            }
            oldImageUrl.current = pendingImageUrl.current;
            
            // Now show the fully loaded image
            setDisplayedImageUrl(pendingImageUrl.current);
            setShowLeaderboard(false);
          }, LEADERBOARD_DURATION);
        } else {
          // Failed to load image, retry after leaderboard duration
          timeoutId = setTimeout(() => {
            if (isMounted) runCycle();
          }, LEADERBOARD_DURATION);
        }
      } else {
        // Currently showing image - wait, then switch to leaderboard
        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          setShowLeaderboard(true);
        }, SLIDE_DURATION);
      }
    };

    runCycle();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showLeaderboard]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (oldImageUrl.current) URL.revokeObjectURL(oldImageUrl.current);
      if (pendingImageUrl.current) URL.revokeObjectURL(pendingImageUrl.current);
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* Slide Image */}
      <div 
        style={{
          ...styles.panel,
          opacity: showLeaderboard ? 0 : 1,
          zIndex: showLeaderboard ? 1 : 2,
        }}
      >
        {displayedImageUrl && (
          <img 
            src={displayedImageUrl} 
            alt="Slide" 
            style={styles.slideImage}
          />
        )}
      </div>

      {/* Leaderboard iframe */}
      <div 
        style={{
          ...styles.panel,
          opacity: showLeaderboard ? 1 : 0,
          zIndex: showLeaderboard ? 2 : 1,
          backgroundColor: '#fff',
        }}
      >
        <iframe
          src="/leaderboard"
          style={styles.iframe}
          title="Leaderboard"
        />
        {/* Transparent overlay to block all clicks on iframe */}
        <div style={styles.iframeOverlay} />
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    transition: 'opacity 0.5s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  iframeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    cursor: 'default',
  },
};

export default SlidesPage;
