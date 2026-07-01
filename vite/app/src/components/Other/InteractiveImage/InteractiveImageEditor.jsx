// -----------------------------------------------------------
//  [*] Other — InteractiveImageEditor
//
//  The admin's link-area editor for a question image. Left
//  side: the image with the areas as draggable/resizable
//  boxes (react-rnd); right side: the list of areas with
//  their URLs, coordinates, add/delete buttons and
//  "Išsaugoti".
//
//  HOW THE COORDINATES WORK
//
//  Areas are stored percent-based relative to the image
//  (x/y/width/height, 0–100), so they survive any display
//  size:
//    - fetched as percent strings ("12.3%") → parsed to
//      plain numbers (12.3) for editing
//    - react-rnd works in on-screen pixels, so every drag/
//      resize is converted px → % and every render % → px
//      against the measured size of the rendered image
//    - saved back as fractions (0.123) via POST to the same
//      URL the areas came from
//
//  Split into (root component last):
//
//    percentToPx / pxToPercent — conversion helpers
//    AreaOverlay   — one draggable/resizable box on the image
//    ImageCanvas   — the image + overlays, self-measuring
//    AreaCard      — one area in the side panel list
//    SidePanel     — heading, buttons and the area list
//    InteractiveImageEditor — state + API calls (default
//                             export)
//
//  Used by:
//    - QuestionsList — the fullscreen "Redaguoti Nuorodas"
//      editor
//    - EditQuestion — the /admin/questions/:questionID page
// -----------------------------------------------------------

import { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import axios from 'axios';
import { Box, Button, TextField, Typography, Grid, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import AddLinkIcon from '@mui/icons-material/AddLink';


// Percent (0–100, relative to the image) ⇄ on-screen pixels
const percentToPx = (percent, total) => (percent / 100) * total;
const pxToPercent = (px, total) => (px / total) * 100;







// -----------------------------------------------------------
// AreaOverlay
// -----------------------------------------------------------
//
// One link area drawn on top of the image: a react-rnd box
// that can be dragged and resized. The selected area is a
// solid pink frame, the rest are dashed blue.
//
// The area's percent coordinates are converted to pixels for
// display; after a drag/resize the new pixel values are
// converted back to percent and reported up via onChange.
// `imageDimensions` carries the rendered image's size plus
// its offset inside the canvas (the image is centered, so it
// rarely starts at 0,0).
//
// Used by:
//   - ImageCanvas (below) — one per area
// -----------------------------------------------------------

function AreaOverlay({ area, selected, imageDimensions, onSelect, onChange }) {

  const { width, height, offsetX, offsetY } = imageDimensions;

  return (
    <Rnd
      // Percent → pixels for display; the offsets shift the box
      // from the canvas corner to the image corner
      size={{
        width: percentToPx(area.width, width),
        height: percentToPx(area.height, height),
      }}
      position={{
        x: percentToPx(area.x, width) + offsetX,
        y: percentToPx(area.y, height) + offsetY,
      }}
      bounds="parent"

      // Pixels → percent after the user moved the box
      onDragStop={(e, d) => {
        onChange(area.id, {
          x: pxToPercent(d.x - offsetX, width),
          y: pxToPercent(d.y - offsetY, height),
        });
      }}

      // Pixels → percent after the user resized the box (a
      // resize can also move the top-left corner, so x/y too)
      onResizeStop={(e, direction, ref, delta, position) => {
        onChange(area.id, {
          width: pxToPercent(ref.offsetWidth, width),
          height: pxToPercent(ref.offsetHeight, height),
          x: pxToPercent(position.x - offsetX, width),
          y: pxToPercent(position.y - offsetY, height),
        });
      }}

      onClick={(e) => {
        e.stopPropagation();
        onSelect(area.id);
      }}

      style={{
        border: selected ? '2px solid rgb(230, 65, 100)' : '1.5px dashed rgb(59, 130, 246)',
        borderRadius: 4,
        position: 'absolute',
        zIndex: selected ? 20 : 10,
        backgroundColor: selected ? 'rgba(230, 65, 100, 0.25)' : 'rgba(59, 130, 246, 0.15)',
      }}
    />
  );
}







// -----------------------------------------------------------
// ImageCanvas
// -----------------------------------------------------------
//
// The left side: the email screenshot on a grey canvas with
// the AreaOverlay boxes on top.
//
// The overlays are positioned in pixels, so the canvas
// measures the rendered image (size + offset inside the
// canvas) on load, on window resizes and on any container
// resize (ResizeObserver — e.g. the fullscreen editor
// opening). Overlays only render once a measurement exists.
//
// h-full down the chain keeps a tall image inside the
// viewport (it shrinks via max-h-full) instead of overflowing
// the fullscreen editor.
//
// Used by:
//   - InteractiveImageEditor (below)
// -----------------------------------------------------------

function ImageCanvas({ src, areas, selectedAreaId, onSelectArea, onAreaChange }) {

  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });


  // Measure the rendered image relative to its canvas Box
  const measureImage = () => {
    if (!imageRef.current) {
      return;
    }

    const canvasRect = imageRef.current.parentNode.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();

    setImageDimensions({
      width: imageRect.width,
      height: imageRect.height,
      offsetX: imageRect.left - canvasRect.left,
      offsetY: imageRect.top - canvasRect.top,
    });

    setImageLoaded(true);
  };


  // Re-measure on window resizes and on container size changes
  // that don't fire a window resize (e.g. layout shifts)
  useEffect(() => {
    window.addEventListener('resize', measureImage);

    const canvas = imageRef.current?.parentNode;
    const observer = new ResizeObserver(measureImage);
    if (canvas) {
      observer.observe(canvas);
    }

    return () => {
      window.removeEventListener('resize', measureImage);
      observer.disconnect();
    };
  }, []);


  return (
    <Grid size={8} className="relative h-full bg-[#EBECEF] p-5">
      <Box className="relative w-full h-full overflow-hidden">
        <img
          ref={imageRef}
          src={src}
          alt="Redaguojamas fišingo laiškas"
          onLoad={measureImage}
          className="max-w-full max-h-full block mx-auto rounded-lg shadow-[2px_4px_10px_1px_rgba(0,0,0,0.15)]"
        />

        {imageLoaded && imageDimensions.width > 0 &&
          areas.map((area) => (
            <AreaOverlay
              key={area.id}
              area={area}
              selected={area.id === selectedAreaId}
              imageDimensions={imageDimensions}
              onSelect={onSelectArea}
              onChange={onAreaChange}
            />
          ))}
      </Box>
    </Grid>
  );
}







// -----------------------------------------------------------
// AreaCard
// -----------------------------------------------------------
//
// One area in the side panel: the number badge (matches the
// order on screen), the URL input, a delete button and the
// coordinates as small grey chips. Clicking the card selects
// the matching overlay on the image (and vice versa — the
// selected card gets the same pink highlight).
//
// Used by:
//   - SidePanel (below) — one per area
// -----------------------------------------------------------

function AreaCard({ area, index, selected, onSelect, onDelete, onUrlChange }) {
  return (
    <div
      className={`rounded-[10px] border p-4 mb-3 cursor-pointer transition-shadow ${
        selected
          ? 'border-[rgb(230,65,100)] bg-[rgba(230,65,100,0.04)] shadow-md'
          : 'border-gray-200 hover:shadow-sm'
      }`}
      onClick={() => onSelect(area.id)}
    >
      {/* Number + URL + delete */}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 shrink-0 rounded-full bg-[rgb(123,0,63)] text-white text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <TextField
          label="Nuoroda"
          variant="outlined"
          fullWidth
          size="small"
          placeholder="https://..."
          value={area.url}
          onChange={(e) => onUrlChange(area.id, e.target.value)}
        />
        <IconButton
          aria-label="delete"
          color="error"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(area.id);
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </div>

      {/* Coordinate chips */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">X: {area.x.toFixed(0)}%</span>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Y: {area.y.toFixed(0)}%</span>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Plotis: {area.width.toFixed(0)}%</span>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Aukštis: {area.height.toFixed(0)}%</span>
      </div>
    </div>
  );
}







// -----------------------------------------------------------
// SidePanel
// -----------------------------------------------------------
//
// The right side: the "Nuorodos (N)" heading with a short
// how-to hint, the Pridėti/Išsaugoti buttons, and one
// AreaCard per area (or a dashed empty-state box). Scrolls
// on its own when there are many areas.
//
// Used by:
//   - InteractiveImageEditor (below)
// -----------------------------------------------------------

function SidePanel({ areas, selectedAreaId, onSelectArea, onAddArea, onDeleteArea, onUrlChange, onSave }) {
  return (
    <Grid size={4} className="h-full overflow-y-auto p-5 bg-white border-l border-gray-200">

      {/* Panel heading */}
      <div className="flex items-center gap-2">
        <AddLinkIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Nuorodos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ({areas.length})
        </Typography>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Pažymėkite laiško vietas, kurios rodys nuorodą — tempkite ir keiskite rėmelių dydį ant paveikslėlio.
      </p>

      {/* Add area / save buttons */}
      <div className="flex gap-2 mb-5">
        <Button variant="outlined" fullWidth startIcon={<AddCircleOutlinedIcon />} onClick={onAddArea}>
          Pridėti
        </Button>
        <Button variant="contained" fullWidth startIcon={<SaveIcon />} onClick={onSave}>
          Išsaugoti
        </Button>
      </div>

      {/* Empty state */}
      {areas.length === 0 && (
        <div className="text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-[10px] p-8">
          Nuorodų dar nėra — paspauskite „Pridėti“.
        </div>
      )}

      {/* One card per area */}
      {areas.map((area, index) => (
        <AreaCard
          key={area.id}
          area={area}
          index={index}
          selected={area.id === selectedAreaId}
          onSelect={onSelectArea}
          onDelete={onDeleteArea}
          onUrlChange={onUrlChange}
        />
      ))}

    </Grid>
  );
}







// -----------------------------------------------------------
// InteractiveImageEditor (default export)
// -----------------------------------------------------------
//
// Holds the areas + selection state and the API calls; the
// visual pieces above are purely presentational. The image
// canvas and the side panel stay in sync through the shared
// selectedAreaId.
//
// Used by:
//   - QuestionsList — the fullscreen "Redaguoti Nuorodas"
//     editor
//   - EditQuestion — the /admin/questions/:questionID page
// -----------------------------------------------------------

export default function InteractiveImageEditor({ src, initialAreasUrl, onSaveButtonClick }) {

  const [areas, setAreas] = useState([]);
  const [areasFetched, setAreasFetched] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(null);


  // Fetch the areas once; percent strings ("12.3%") → plain
  // numbers (12.3) so they can be edited
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await axios.get(initialAreasUrl);
        setAreas(response.data.map((area) => ({
          ...area,
          x: parseFloat(area.x.replace('%', '')),
          y: parseFloat(area.y.replace('%', '')),
          width: parseFloat(area.width.replace('%', '')),
          height: parseFloat(area.height.replace('%', '')),
        })));
        setAreasFetched(true);
      } catch (error) {
        console.error('Error fetching clickable areas:', error);
      }
    };
    fetchAreas();
  }, [initialAreasUrl]);


  // Add a new area near the top-left corner, selected right
  // away so the admin can drag it into place
  const handleAddArea = () => {
    const newArea = {
      id: Date.now(),
      url: '',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    };
    setAreas((prevAreas) => [...prevAreas, newArea]);
    setSelectedAreaId(newArea.id);
  };


  const handleDeleteArea = (id) => {
    setAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
    if (selectedAreaId === id) {
      setSelectedAreaId(null);
    }
  };


  // Merge changed props into one area; numeric props (the
  // coordinates) are rounded to whole percent
  const handleAreaChange = (id, newProps) => {
    const roundedProps = Object.keys(newProps).reduce((acc, key) => {
      acc[key] = typeof newProps[key] === 'number' ? Math.round(newProps[key]) : newProps[key];
      return acc;
    }, {});

    setAreas((prevAreas) =>
      prevAreas.map((area) => (area.id === id ? { ...area, ...roundedProps } : area))
    );
  };

  const handleUrlChange = (id, url) => handleAreaChange(id, { url });


  // Save all areas back (percent → 0–1 fractions, as the
  // backend stores them) and hand control back to the caller
  const handleSave = async () => {
    try {
      const areasInFraction = areas.map((area) => ({
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


  if (!areasFetched) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Kraunasi...
      </div>
    );
  }


  return (
    <Grid container className="h-full">

      <ImageCanvas
        src={src}
        areas={areas}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
        onAreaChange={handleAreaChange}
      />

      <SidePanel
        areas={areas}
        selectedAreaId={selectedAreaId}
        onSelectArea={setSelectedAreaId}
        onAddArea={handleAddArea}
        onDeleteArea={handleDeleteArea}
        onUrlChange={handleUrlChange}
        onSave={handleSave}
      />

    </Grid>
  );
}
