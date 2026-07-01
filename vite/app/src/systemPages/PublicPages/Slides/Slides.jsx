// -----------------------------------------------------------
//  [*] Public — Slides page (projector kiosk)
//
//  Fullscreen loop for the event projector, alternating every
//  6 s between:
//    - a random slide image from /api/leaderboard/nextslide
//      (the files in _DATA/slides, managed via filebrowser)
//    - the live /leaderboard page in an iframe (behind a
//      transparent overlay so stray clicks do nothing)
//
//  The next image is preloaded as an object URL while the
//  leaderboard is showing, so the cross-fade never flashes a
//  half-loaded image; old object URLs are revoked to avoid
//  leaking memory. If fetching a slide fails the leaderboard
//  simply stays up and it retries next cycle.
//
//  Used by:
//    - App.jsx — route /slides (opened from the admin sidebar)
// -----------------------------------------------------------

import { useState, useEffect, useRef } from 'react';


const SLIDE_DURATION = 6000;
const LEADERBOARD_DURATION = 6000;


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







// -----------------------------------------------------------
// SlidesPage (default export)
// -----------------------------------------------------------

export default function SlidesPage() {

  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [displayedImageUrl, setDisplayedImageUrl] = useState(null);
  const pendingImageUrl = useRef(null);
  const oldImageUrl = useRef(null);


  // Fetch a random slide and wait until the browser has fully
  // decoded it; returns a ready-to-show object URL (or null)
  const preloadNewSlide = async () => {
    try {
      const response = await fetch("/api/leaderboard/nextslide");
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

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


  // The main leaderboard ⇄ slide cycle. Re-runs on every phase
  // change (showLeaderboard flip); cleanup guards against
  // updates after unmount.
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const runCycle = async () => {
      if (!isMounted) return;

      if (showLeaderboard) {
        // Leaderboard phase — preload the next image meanwhile
        const readyImageUrl = await preloadNewSlide();

        if (!isMounted) {
          if (readyImageUrl) URL.revokeObjectURL(readyImageUrl);
          return;
        }

        if (readyImageUrl) {
          pendingImageUrl.current = readyImageUrl;

          // When the leaderboard time is up, swap to the image
          timeoutId = setTimeout(() => {
            if (!isMounted) return;

            if (oldImageUrl.current) {
              URL.revokeObjectURL(oldImageUrl.current);
            }
            oldImageUrl.current = pendingImageUrl.current;

            setDisplayedImageUrl(pendingImageUrl.current);
            setShowLeaderboard(false);
          }, LEADERBOARD_DURATION);
        } else {
          // No slide available — keep the leaderboard and retry
          timeoutId = setTimeout(() => {
            if (isMounted) runCycle();
          }, LEADERBOARD_DURATION);
        }
      } else {
        // Slide phase — wait, then back to the leaderboard
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


  // Release the object URLs on unmount
  useEffect(() => {
    return () => {
      if (oldImageUrl.current) URL.revokeObjectURL(oldImageUrl.current);
      if (pendingImageUrl.current) URL.revokeObjectURL(pendingImageUrl.current);
    };
  }, []);


  return (
    <div style={styles.container}>

      {/* Slide image */}
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
            alt="Skaidrė"
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
        {/* Transparent overlay blocking clicks on the iframe */}
        <div style={styles.iframeOverlay} />
      </div>

    </div>
  );
}
