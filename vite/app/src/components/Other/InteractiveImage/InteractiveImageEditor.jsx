// -----------------------------------------------------------
//  [*] Other — InteractiveImageEditor
//
//  The admin's link-area editor for a question image. Left
//  side: the image with the areas as draggable/resizable
//  boxes (react-rnd); right side: the list of areas with
//  their URLs, coordinates, an add and a delete button, and
//  "Išsaugoti Pokyčius".
//
//  Coordinates are percent-based relative to the image, so
//  they survive any display size:
//    - fetched as percent strings ("12.3%") → parsed to numbers
//    - edited in pixels on screen (converted both ways)
//    - saved back as fractions (0.123) via POST to the same
//      URL the areas came from
//
//  A ResizeObserver on the image container keeps the overlay
//  boxes aligned when the layout (not just the window) resizes.
//
//  Used by:
//    - QuestionsList — the fullscreen "Redaguoti Nuorodas"
//      editor
//    - EditQuestion — the /admin/questions/:questionID page
// -----------------------------------------------------------

import { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import axios from 'axios';
import { Box, Button, TextField, Typography, Grid, Paper, IconButton } from '@mui/material';
import { Delete } from '@mui/icons-material';


export default function EditableInteractiveImage({ src, initialAreasUrl, onSaveButtonClick }) {

  const [clickableAreas, setClickableAreas] = useState([]);
  const [isAreasFetched, setIsAreasFetched] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const imageRef = useRef(null);


  // Fetch the areas once; percent strings → plain numbers
  useEffect(() => {
    const fetchClickableAreas = async () => {
      try {
        const response = await axios.get(initialAreasUrl);
        const areas = response.data.map((area) => ({
          ...area,
          x: parseFloat(area.x.replace('%', '')),
          y: parseFloat(area.y.replace('%', '')),
          width: parseFloat(area.width.replace('%', '')),
          height: parseFloat(area.height.replace('%', '')),
        }));
        setClickableAreas(areas);
        setIsAreasFetched(true);
      } catch (error) {
        console.error('Error fetching clickable areas:', error);
      }
    };
    fetchClickableAreas();
  }, [initialAreasUrl]);


  // The overlay boxes are positioned in pixels — measure the
  // rendered image on load and whenever the layout changes
  const handleImageLoad = () => {
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

      setImageLoaded(true);
    }
  };

  useEffect(() => {
    const handleResize = () => handleImageLoad();
    window.addEventListener('resize', handleResize);

    // Also track container size changes (e.g. the fullscreen
    // editor opening) that don't fire a window resize
    const box = imageRef.current?.parentNode;
    let observer;
    if (box) {
      observer = new ResizeObserver(() => handleImageLoad());
      observer.observe(box);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, []);


  // Percent ⇄ pixel conversion helpers
  const convertPercentToPx = (percent, total) => (percent / 100) * total;
  const convertPxToPercent = (px, total) => (px / total) * 100;


  // Add a new area (top-left corner, selected right away)
  const handleAddArea = () => {
    const newArea = {
      id: Date.now(),
      url: '',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    };
    setClickableAreas((prevAreas) => [...prevAreas, newArea]);
    setSelectedAreaId(newArea.id);
  };


  const handleDeleteArea = (id) => {
    setClickableAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
    if (selectedAreaId === id) {
      setSelectedAreaId(null);
    }
  };


  // Update an area; numeric props are rounded to whole percent
  const handleAreaChange = (id, newProps) => {
    const roundedProps = Object.keys(newProps).reduce((acc, key) => {
      acc[key] = typeof newProps[key] === 'number' ? Math.round(newProps[key]) : newProps[key];
      return acc;
    }, {});

    setClickableAreas((prevAreas) =>
      prevAreas.map((area) => (area.id === id ? { ...area, ...roundedProps } : area))
    );
  };


  // Save all areas back (as 0–1 fractions) and hand control
  // back to the caller
  const handleSave = async () => {
    try {
      const areasInFraction = clickableAreas.map((area) => ({
        id: area.id,
        url: area.url,
        x: Math.round(area.x) / 100,
        y: Math.round(area.y) / 100,
        width: Math.round(area.width) / 100,
        height: Math.round(area.height) / 100,
      }));

      await axios.post(initialAreasUrl, { areas: areasInFraction });

      if (onSaveButtonClick) {
        onSaveButtonClick();
      }
    } catch (error) {
      console.error('Error during POST request:', error);
    }
  };


  if (!isAreasFetched) {
    return <>Kraunasi...</>;
  }


  return (
    <Grid container>

      {/* Left side — image with the draggable/resizable areas */}
      <Grid size={8} style={{ position: 'relative' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            border: '1px solid lightgrey',
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt="Redaguojamas fišingo laiškas"
            onLoad={handleImageLoad}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
              margin: '0 auto',
            }}
          />

          {imageLoaded &&
            imageDimensions.width > 0 &&
            clickableAreas.map((area) => {
              const areaX = convertPercentToPx(area.x, imageDimensions.width);
              const areaY = convertPercentToPx(area.y, imageDimensions.height);
              const areaWidth = convertPercentToPx(area.width, imageDimensions.width);
              const areaHeight = convertPercentToPx(area.height, imageDimensions.height);

              return (
                <Rnd
                  key={area.id}
                  size={{ width: areaWidth, height: areaHeight }}
                  position={{ x: areaX + imageDimensions.offsetX, y: areaY + imageDimensions.offsetY }}
                  bounds="parent"
                  onDragStop={(e, d) => {
                    handleAreaChange(area.id, {
                      x: convertPxToPercent(d.x - imageDimensions.offsetX, imageDimensions.width),
                      y: convertPxToPercent(d.y - imageDimensions.offsetY, imageDimensions.height),
                    });
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    handleAreaChange(area.id, {
                      width: convertPxToPercent(ref.offsetWidth, imageDimensions.width),
                      height: convertPxToPercent(ref.offsetHeight, imageDimensions.height),
                      x: convertPxToPercent(position.x - imageDimensions.offsetX, imageDimensions.width),
                      y: convertPxToPercent(position.y - imageDimensions.offsetY, imageDimensions.height),
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAreaId(area.id);
                  }}
                  style={{
                    border: area.id === selectedAreaId ? '2px solid red' : '1px dashed blue',
                    position: 'absolute',
                    zIndex: selectedAreaId === area.id ? 20 : 10,
                    backgroundColor: 'rgba(0, 255, 0, 0.3)',
                  }}
                />
              );
            })}
        </Box>
      </Grid>

      {/* Right side — controls and the area list */}
      <Grid size={4} style={{ overflowY: 'auto', padding: 16 }}>
        <Typography variant="h6" gutterBottom>
          Nuorodų Redagavimas
        </Typography>

        {/* Add area / save buttons */}
        <Box mb={2}>
          <Button variant="contained" color="primary" onClick={handleAddArea}>
            Pridėti Nuorodą
          </Button>
          <Button variant="contained" color="success" onClick={handleSave} style={{ marginLeft: 8 }}>
            Išsaugoti Pokyčius
          </Button>
        </Box>

        {/* One card per area */}
        {clickableAreas.map((area) => (
          <Paper
            key={area.id}
            elevation={selectedAreaId === area.id ? 4 : 1}
            sx={{
              padding: 2,
              marginBottom: 2,
              border: selectedAreaId === area.id ? '2px solid red' : '1px solid #ccc',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedAreaId(area.id)}
          >
            <Grid container alignItems="center" spacing={1}>
              <Grid size={10}>
                <TextField
                  label="Nuoroda"
                  variant="outlined"
                  fullWidth
                  size="small"
                  value={area.url}
                  onChange={(e) => handleAreaChange(area.id, { url: e.target.value })}
                />
              </Grid>
              <Grid size={2}>
                <IconButton
                  aria-label="delete"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteArea(area.id);
                  }}
                >
                  <Delete />
                </IconButton>
              </Grid>
            </Grid>
            <Box mt={1}>
              <Typography variant="body2">
                <b>Koordinatės:</b> X: {area.x.toFixed(2)}%, Y: {area.y.toFixed(2)}%
              </Typography>
              <Typography variant="body2">
                <b>Dydis:</b> Plotis: {area.width.toFixed(2)}%, Aukštis: {area.height.toFixed(2)}%
              </Typography>
            </Box>
          </Paper>
        ))}
      </Grid>

    </Grid>
  );
}
