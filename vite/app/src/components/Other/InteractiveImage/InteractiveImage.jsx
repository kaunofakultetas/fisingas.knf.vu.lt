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
//  for the src that is actually on screen (loadedSrc), so
//  switching questions never shows stale areas.
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
//    - QuestionsList — question editing preview
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";


// Area coordinates come as percent strings ("12.3%") — parse
// and scale them against the rendered image size
const percentToPx = (percentString, total) => (parseFloat(percentString) / 100) * total;







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
// is measured on load and re-measured on window resizes.
//
// Used by:
//   - TestHome / StudentAnswers / QuestionsList
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


  

  // Fetch the clickable areas once the image is on screen
  useEffect(() => {
    async function fetchClickableAreas() {
      try {
        const response = await fetch(clickableAreasUrl);
        const data = await response.json();
        setClickableAreas(data);
      } catch (error) {
        console.error('Error fetching clickable areas:', error);
      }
    }

    if (clickableAreasUrl && imageLoaded === true) {
      fetchClickableAreas();
    }
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



  // Re-measure when the window resizes
  useEffect(() => {
    window.addEventListener('resize', updateImageDimensions);
    return () => window.removeEventListener('resize', updateImageDimensions);
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
