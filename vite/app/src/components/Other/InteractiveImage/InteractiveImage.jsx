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
//    - clickablAreaColor — overlay fill; the test page passes
//      transparent so students don't see the areas highlighted
//    - onImageClick      — the test page opens the fullscreen
//      viewer with it
//
//  Used by:
//    - TestHome — the question image + fullscreen viewer
//    - StudentAnswers — answer review (admin + results pages)
//    - QuestionsList — question editing preview
// -----------------------------------------------------------

import { useState, useEffect, useRef } from "react";


export default function InteractiveImage({ src, clickableAreasUrl, clickablAreaColor = 'rgba(255, 255, 0, 0.5)', onImageClick, containerStyle, imageStyle }) {

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


  // The overlays are positioned in pixels, so remeasure the
  // rendered image on load and on window resizes
  const updateImageDimensions = () => {
    if (imageRef.current) {
      const imageContainer = imageRef.current.parentNode;
      const containerRect = imageContainer.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();

      setImageDimensions({
        width: imageRect.width,
        height: imageRect.height,
        offsetX: imageRect.left - containerRect.left,
        offsetY: imageRect.top - containerRect.top,
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateImageDimensions);
    return () => window.removeEventListener('resize', updateImageDimensions);
  }, []);


  // Area coordinates come as percent strings ("12.3%")
  const convertPercentToPx = (percentString, total) => {
    const percentage = parseFloat(percentString) / 100;
    return percentage * total;
  };


  return (
    <div
      style={{ position: 'relative', ...containerStyle }}
      onClick={onImageClick}
    >
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

      {/* Clickable overlay areas */}
      {imageLoaded && imageRef.current && clickableAreas.length !== 0 &&
        clickableAreas.map((area) => (
          <div
            key={area.id}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoveredArea(area);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setHoveredArea(null);
            }}
            style={{
              position: 'absolute',
              top: `${imageDimensions.offsetY + convertPercentToPx(area.y, imageDimensions.height)}px`,
              left: `${imageDimensions.offsetX + convertPercentToPx(area.x, imageDimensions.width)}px`,
              width: `${convertPercentToPx(area.width, imageDimensions.width)}px`,
              height: `${convertPercentToPx(area.height, imageDimensions.height)}px`,
              backgroundColor: clickablAreaColor,
              cursor: 'pointer',
            }}
          />
        ))}

      {/* Tooltip showing the hovered link's URL */}
      {hoveredArea && imageLoaded && imageRef.current && (
        <div
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredArea(hoveredArea);
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            setHoveredArea(null);
          }}
          style={{
            position: 'absolute',
            top: `${imageDimensions.offsetY + convertPercentToPx(hoveredArea.y, imageDimensions.height) - 30}px`,
            left: `${imageDimensions.offsetX + convertPercentToPx(hoveredArea.x, imageDimensions.width)}px`,
            padding: '5px 10px',
            backgroundColor: 'black',
            color: 'white',
            borderRadius: '5px',
            zIndex: 10,
          }}
        >
          {hoveredArea.url}
        </div>
      )}
    </div>
  );
}
