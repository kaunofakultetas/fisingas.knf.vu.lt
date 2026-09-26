// -----------------------------------------------------------
//  [*] Other — InteractiveImage
//
//  Shows a phishing email screenshot with the clickable link
//  areas overlaid on top of it. The areas come from the
//  backend (percent-based coordinates relative to the image)
//  and hovering one shows the link's URL in a black tooltip —
//  just like a real email client would.
//
//  The image is blurred until it loads; overlays only appear
//  for the src that is actually on screen (loadedSrc). A new
//  src starts without areas and without a URL bubble, and a
//  late reply to the previous src's request is dropped — the
//  next question never shows the previous one's links.
//
//  The overlays are placed in pixels, so the image is
//  re-measured whenever it or its container changes size
//  (ResizeObserver — e.g. the admin sidebar pinned, a
//  scrollbar appearing) as well as on window resizes.
//
//  Props worth knowing:
//    - clickableAreaColor — overlay fill; the test page passes
//      transparent so students don't see the areas highlighted
//    - onImageClick       — the test page opens the fullscreen
//      viewer with it
//
//  Split into (root component last):
//
//    percentToPx      — percent-string → pixel helper
//    AreaHighlight    — one hoverable link area overlay
//    UrlTooltip       — the black URL bubble above an area
//    InteractiveImage — state + measurement (default export)
//
//  Used by:
//    - TestHome — the question image + fullscreen viewer
//    - StudentAnswers — answer review (admin + results pages)
//    - QuestionCard — the question bank's preview
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";


// Area coordinates come as percent strings ("12.3%") — parse
// and scale them against the rendered image size. A null (a
// stored value the API cannot parse) counts as 0, as in the
// link editor — NaN would leave the box without a position
const percentToPx = (percentString, total) => ((parseFloat(percentString) || 0) / 100) * total;







// -----------------------------------------------------------
// AreaHighlight
// -----------------------------------------------------------
//
// One link area drawn over the image: an absolutely
// positioned box at the area's percent coordinates (converted
// to pixels against the measured image). Reports hover
// up so the parent can show/hide the URL tooltip.
//
// `imageDimensions` carries the rendered image's size plus
// its offset inside the container (the image may not start
// at 0,0 — e.g. when centered).
//
// Used by:
//   - InteractiveImage (below) — one per area
// -----------------------------------------------------------

function AreaHighlight({ area, color, imageDimensions, onHoverChange }) {

  const { width, height, offsetX, offsetY } = imageDimensions;

  return (
    <div
      onMouseEnter={(e) => {
        e.stopPropagation();
        onHoverChange(area);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        onHoverChange(null);
      }}
      style={{
        position: 'absolute',
        top: `${offsetY + percentToPx(area.y, height)}px`,
        left: `${offsetX + percentToPx(area.x, width)}px`,
        width: `${percentToPx(area.width, width)}px`,
        height: `${percentToPx(area.height, height)}px`,
        backgroundColor: color,
        cursor: 'pointer',
      }}
    />
  );
}







// -----------------------------------------------------------
// UrlTooltip
// -----------------------------------------------------------
//
// The black bubble showing the hovered link's URL, floating
// just above the hovered area — mimicking the link preview
// of a real email client. It keeps itself alive while the
// mouse is over it (the bubble overlaps the area's edge).
//
// Used by:
//   - InteractiveImage (below)
// -----------------------------------------------------------

function UrlTooltip({ area, imageDimensions, onHoverChange }) {

  const { width, height, offsetX, offsetY } = imageDimensions;

  return (
    <div
      onMouseEnter={(e) => {
        e.stopPropagation();
        onHoverChange(area);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        onHoverChange(null);
      }}
      style={{
        position: 'absolute',
        top: `${offsetY + percentToPx(area.y, height) - 30}px`,
        left: `${offsetX + percentToPx(area.x, width)}px`,
        padding: '5px 10px',
        backgroundColor: 'black',
        color: 'white',
        borderRadius: '5px',
        zIndex: 10,
      }}
    >
      {area.url}
    </div>
  );
}







// -----------------------------------------------------------
// InteractiveImage (default export)
// -----------------------------------------------------------
//
// Holds the state: which src is loaded, the fetched areas,
// the measured image dimensions and the hovered area. The
// overlays are positioned in pixels, so the rendered image
// is measured on load and re-measured whenever it or its
// container resizes.
//
// Used by:
//   - TestHome / StudentAnswers / QuestionCard
// -----------------------------------------------------------

export default function InteractiveImage({ src, clickableAreasUrl, clickableAreaColor = 'rgba(255, 255, 0, 0.5)', onImageClick, containerStyle, imageStyle }) {

  const [hoveredArea, setHoveredArea] = useState(null);
  const [clickableAreas, setClickableAreas] = useState([]);
  const imageRef = useRef(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // Track which src is loaded instead of a boolean — avoids a
  // race condition when the src prop changes mid-load
  const [loadedSrc, setLoadedSrc] = useState(null);
  const imageLoaded = loadedSrc === src;


  // A new src (the test page reuses one viewer for every
  // question) drops the previous image's areas and URL bubble
  // right in the render that brings it — before the next image
  // could show them. A keyboard switch fires no mouseleave, so
  // nothing else would close that bubble
  const [areasSrc, setAreasSrc] = useState(src);
  if (areasSrc !== src) {
    setAreasSrc(src);
    setClickableAreas([]);
    setHoveredArea(null);
  }


  // Fetch the clickable areas once the image is on screen. A
  // reply that arrives after the src or URL changed (or after
  // unmount) is outdated and dropped, success or failure alike
  // — it must never land on the next image
  useEffect(() => {
    let outdated = false;

    async function fetchClickableAreas() {
      try {
        const response = await fetch(clickableAreasUrl);
        const data = await response.json();
        if (!outdated) {
          setClickableAreas(data);
        }
      } catch (error) {
        if (!outdated) {
          console.error('Error fetching clickable areas:', error);
        }
      }
    }

    if (clickableAreasUrl && imageLoaded === true) {
      fetchClickableAreas();
    }

    return () => {
      outdated = true;
    };
  }, [imageLoaded, src, clickableAreasUrl]);


  // Measure the rendered image relative to its container
  const updateImageDimensions = () => {
    if (!imageRef.current) {
      return;
    }

    const containerRect = imageRef.current.parentNode.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();

    setImageDimensions({
      width: imageRect.width,
      height: imageRect.height,
      offsetX: imageRect.left - containerRect.left,
      offsetY: imageRect.top - containerRect.top,
    });
  };


  // Re-measure on window resizes, and whenever the image or its
  // container changes size without one (the admin sidebar
  // pinned, a scrollbar appearing). The container too: when it
  // resizes, a centered image moves even if its own size stays
  useEffect(() => {
    window.addEventListener('resize', updateImageDimensions);

    const image = imageRef.current;
    const observer = new ResizeObserver(updateImageDimensions);
    observer.observe(image);
    observer.observe(image.parentNode);

    return () => {
      window.removeEventListener('resize', updateImageDimensions);
      observer.disconnect();
    };
  }, []);


  return (
    <div
      style={{ position: 'relative', ...containerStyle }}
      onClick={onImageClick}
    >
      {/* The screenshot — blurred until this exact src loads */}
      <img
        ref={imageRef}
        src={src}
        alt="Fišingo El. Laiškas"
        style={{ ...imageStyle, filter: imageLoaded === false ? 'blur(3px)' : undefined }}
        onLoad={() => {
          updateImageDimensions();
          setLoadedSrc(src);
        }}
      />

      {/* Clickable link areas */}
      {imageLoaded && imageRef.current && clickableAreas.map((area) => (
        <AreaHighlight
          key={area.id}
          area={area}
          color={clickableAreaColor}
          imageDimensions={imageDimensions}
          onHoverChange={setHoveredArea}
        />
      ))}

      {/* URL bubble above the hovered area */}
      {hoveredArea && imageLoaded && imageRef.current && (
        <UrlTooltip
          area={hoveredArea}
          imageDimensions={imageDimensions}
          onHoverChange={setHoveredArea}
        />
      )}
    </div>
  );
}
