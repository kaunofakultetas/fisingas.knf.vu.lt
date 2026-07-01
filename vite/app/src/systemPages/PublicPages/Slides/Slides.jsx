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
//  Split into (root component last):
//
//    preloadNewSlide  — fetch + decode a slide image
//    useSlideCycle    — the leaderboard ⇄ slide loop
//    SlidePanel       — the fullscreen slide image layer
//    LeaderboardPanel — the fullscreen leaderboard layer
//    SlidesPage       — the two layers (default export)
//
//  Used by:
//    - App.jsx — route /slides (opened from the admin sidebar)
// -----------------------------------------------------------

import { useState, useEffect } from 'react';


const SLIDE_DURATION = 20000;
const LEADERBOARD_DURATION = 6000;


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));







// -----------------------------------------------------------
// preloadNewSlide
// -----------------------------------------------------------
//
// Fetch a random slide and wait until the browser has fully
// decoded it; returns a ready-to-show object URL (or null on
// any failure). The caller owns the URL and must revoke it.
// -----------------------------------------------------------

async function preloadNewSlide() {
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
}







// -----------------------------------------------------------
// useSlideCycle
// -----------------------------------------------------------
//
// The leaderboard ⇄ slide cycle, written as one linear loop:
//
//   1. Show the leaderboard; meanwhile preload the next slide
//      (both run in parallel for LEADERBOARD_DURATION).
//   2. No slide available? Stay on the leaderboard and retry.
//   3. Otherwise swap the slide in (revoking the previous
//      one's object URL), show it for SLIDE_DURATION, repeat.
//
// Unmount flips `cancelled`, which stops the loop at its next
// await and releases whatever object URL is still alive.
//
// Returns { showLeaderboard, displayedImageUrl }.
//
// Used by:
//   - SlidesPage (below)
// -----------------------------------------------------------

function useSlideCycle() {

  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [displayedImageUrl, setDisplayedImageUrl] = useState(null);


  useEffect(() => {
    let cancelled = false;
    let shownUrl = null;

    const runLoop = async () => {
      while (!cancelled) {
        // Leaderboard phase — preload the next slide meanwhile
        setShowLeaderboard(true);
        const [nextUrl] = await Promise.all([
          preloadNewSlide(),
          sleep(LEADERBOARD_DURATION),
        ]);

        if (cancelled) {
          if (nextUrl) URL.revokeObjectURL(nextUrl);
          return;
        }

        // No slide available — keep the leaderboard and retry
        if (!nextUrl) continue;

        // Slide phase — swap in the preloaded image
        if (shownUrl) URL.revokeObjectURL(shownUrl);
        shownUrl = nextUrl;

        setDisplayedImageUrl(nextUrl);
        setShowLeaderboard(false);
        await sleep(SLIDE_DURATION);
      }
    };

    runLoop();

    return () => {
      cancelled = true;
      if (shownUrl) URL.revokeObjectURL(shownUrl);
    };
  }, []);


  return { showLeaderboard, displayedImageUrl };
}







// -----------------------------------------------------------
// SlidePanel
// -----------------------------------------------------------
//
// The fullscreen slide image layer. Both panels are always
// mounted on top of each other and cross-fade via opacity;
// the visible one also gets the higher z-index so it receives
// no clicks through the hidden one.
//
// Used by:
//   - SlidesPage (below)
// -----------------------------------------------------------

function SlidePanel({ visible, imageUrl }) {
  return (
    <div
      className={`absolute top-0 left-0 w-full h-full flex items-center justify-center transition-opacity duration-500 ease-in-out
        ${visible ? 'opacity-100 z-2' : 'opacity-0 z-1'}`}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Skaidrė"
          className="w-full h-full object-contain"
        />
      )}
    </div>
  );
}







// -----------------------------------------------------------
// LeaderboardPanel
// -----------------------------------------------------------
//
// The fullscreen leaderboard layer: the live /leaderboard
// page in an iframe, behind a transparent overlay so stray
// clicks on the projector machine do nothing.
//
// Used by:
//   - SlidesPage (below)
// -----------------------------------------------------------

function LeaderboardPanel({ visible }) {
  return (
    <div
      className={`absolute top-0 left-0 w-full h-full flex items-center justify-center bg-white transition-opacity duration-500 ease-in-out
        ${visible ? 'opacity-100 z-2' : 'opacity-0 z-1'}`}
    >
      <iframe
        src="/leaderboard"
        className="w-full h-full border-none"
        title="Leaderboard"
      />
      {/* Transparent overlay blocking clicks on the iframe */}
      <div className="absolute top-0 left-0 w-full h-full cursor-default" />
    </div>
  );
}







// -----------------------------------------------------------
// SlidesPage (default export)
// -----------------------------------------------------------
//
// Used by:
//   - App.jsx — route /slides
// -----------------------------------------------------------

export default function SlidesPage() {

  const { showLeaderboard, displayedImageUrl } = useSlideCycle();

  return (
    <div className="fixed top-0 left-0 w-screen h-screen bg-black overflow-hidden">
      <SlidePanel visible={!showLeaderboard} imageUrl={displayedImageUrl} />
      <LeaderboardPanel visible={showLeaderboard} />
    </div>
  );
}
