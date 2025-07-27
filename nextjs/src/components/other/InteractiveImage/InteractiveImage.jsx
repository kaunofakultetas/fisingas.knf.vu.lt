'use client';
import React, { useState, useEffect, useRef } from "react";

const InteractiveImage = ({ src, clickableAreasUrl, clickablAreaColor='rgba(255, 255, 0, 0.5)', onImageClick, containerStyle, imageStyle }) => {
  const [hoveredArea, setHoveredArea] = useState(null);
  const [clickableAreas, setClickableAreas] = useState([]);
  const imageRef = useRef(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [imageLoaded, setImageLoaded] = useState(false);


  useEffect(() => {
    setImageLoaded(false);
  }, [src]);


  // **Fetch clickable areas from the provided URL**
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

  // **Update image dimensions when the image loads or window resizes**
  const updateImageDimensions = () => {
    if (imageRef.current) {
      const imageContainer = imageRef.current.parentNode;
      const containerRect = imageContainer.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();

      const offsetX = imageRect.left - containerRect.left;
      const offsetY = imageRect.top - containerRect.top;

      const width = imageRect.width;
      const height = imageRect.height;

      setImageDimensions({ width, height, offsetX, offsetY });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      updateImageDimensions();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // **Convert percentage strings to pixel values based on image dimensions**
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
        style={{ ...imageStyle, filter: imageLoaded === false ? 'blur(3px)' : undefined}}
        onLoad={() => {
          updateImageDimensions();
          setImageLoaded(true);
        }}
      />

      {/* **Clickable overlay areas** */}
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

      {/* **Tooltip showing URL** */}
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
};

export default InteractiveImage;
