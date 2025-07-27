// EditableInteractiveImage.js
import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import axios from 'axios';
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Paper,
  IconButton,
} from '@mui/material';
import { Delete } from '@mui/icons-material';

const EditableInteractiveImage = ({
  src,
  initialAreasUrl,
  onSaveButtonClick
}) => {
  const [clickableAreas, setClickableAreas] = useState([]);
  const [isAreasFetched, setIsAreasFetched] = useState(0);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const imageRef = useRef(null);


  // Fetch clickable areas on component mount
  useEffect(() => {
    const fetchClickableAreas = async () => {
      try {
        const response = await axios.get(initialAreasUrl);
        const areas = response.data.map((area) => ({
          ...area,
          x: parseFloat(area.x.replace('%', '')), // Convert x to a number, stripping %
          y: parseFloat(area.y.replace('%', '')), // Convert y to a number, stripping %
          width: parseFloat(area.width.replace('%', '')), // Convert width to a number, stripping %
          height: parseFloat(area.height.replace('%', '')), // Convert height to a number, stripping %
        }));
        setClickableAreas(areas);
        setIsAreasFetched(1);
        console.log('Fetched areas:', areas); // Log the fetched areas to verify
      } catch (error) {
        console.error('Error fetching clickable areas:', error);
      }
    };
    fetchClickableAreas();
  }, [initialAreasUrl]);




  // Handle image load and calculate dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const offsetX = imageRef.current.offsetLeft;
      const offsetY = imageRef.current.offsetTop;

      setImageDimensions({
        width: rect.width,
        height: rect.height,
        offsetX: offsetX,
        offsetY: offsetY,
      });

      setImageLoaded(true);

      console.log('Image dimensions:', {
        width: rect.width,
        height: rect.height,
        offsetX,
        offsetY,
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      handleImageLoad();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Conversion helpers
  const convertPercentToPx = (percent, total) => (percent / 100) * total;
  const convertPxToPercent = (px, total) => (px / total) * 100;


  // Add new area
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


  // Delete area
  const handleDeleteArea = (id) => {
    setClickableAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
    if (selectedAreaId === id) {
      setSelectedAreaId(null);
    }
  };


  // Update area properties
  const handleAreaChange = (id, newProps) => {
    // Round the newProps to whole numbers before applying them
    const roundedProps = Object.keys(newProps).reduce((acc, key) => {
      // Only round numeric values (e.g., x, y, width, height)
      acc[key] = typeof newProps[key] === 'number' ? Math.round(newProps[key]) : newProps[key];
      return acc;
    }, {});
  
    setClickableAreas((prevAreas) =>
      prevAreas.map((area) => (area.id === id ? { ...area, ...roundedProps } : area))
    );
  };


  // Save areas
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
  
      const response = await axios.post(initialAreasUrl, {
        areas: areasInFraction,
      });
  
      console.log('POST request successful:', response.data);
      if(onSaveButtonClick){
        onSaveButtonClick();
      }
    } catch (error) {
      console.error('Error during POST request:', error);
    }
  };
  
  


  if(isAreasFetched === 0){
    return (<>Kraunasi...</>)
  }

  // Rendering logic
  return (
    <Grid container>
      {/* Left Side: Image with Clickable Areas */}
      <Grid item xs={8} style={{ position: 'relative' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            // height: '100%',
            overflow: 'hidden',
            border: '1px solid lightgrey'
          }}
        >
          {/* Image */}
          <img
            ref={imageRef}
            src={src}
            alt="Editable"
            onLoad={handleImageLoad}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
              margin: '0 auto',
            }}
          />

          {/* Render clickable areas */}
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
                    const newX = convertPxToPercent(
                      d.x - imageDimensions.offsetX,
                      imageDimensions.width
                    );
                    const newY = convertPxToPercent(
                      d.y - imageDimensions.offsetY,
                      imageDimensions.height
                    );
                    handleAreaChange(area.id, { x: newX, y: newY });
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    const newWidth = convertPxToPercent(
                      ref.offsetWidth,
                      imageDimensions.width
                    );
                    const newHeight = convertPxToPercent(
                      ref.offsetHeight,
                      imageDimensions.height
                    );
                    const newX = convertPxToPercent(
                      position.x - imageDimensions.offsetX,
                      imageDimensions.width
                    );
                    const newY = convertPxToPercent(
                      position.y - imageDimensions.offsetY,
                      imageDimensions.height
                    );
                    handleAreaChange(area.id, {
                      width: newWidth,
                      height: newHeight,
                      x: newX,
                      y: newY,
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

      {/* Right Side: Controls and Area List */}
      <Grid item xs={4} style={{ overflowY: 'auto', padding: 16 }}>
        <Typography variant="h6" gutterBottom>
          Nuorodų Redagavimas
        </Typography>

        {/* Add Area and Save Buttons */}
        <Box mb={2}>
          <Button variant="contained" color="primary" onClick={handleAddArea}>
            Pridėti Nuorodą
          </Button>
          <Button variant="contained" color="success" onClick={handleSave} style={{ marginLeft: 8 }}>
            Išsaugoti Pokyčius
          </Button>
        </Box>

        {/* List of Areas */}
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
              <Grid item xs={10}>
                <TextField
                  label="Nuoroda"
                  variant="outlined"
                  fullWidth
                  size="small"
                  value={area.url}
                  onChange={(e) => handleAreaChange(area.id, { url: e.target.value })}
                />
              </Grid>
              <Grid item xs={2}>
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
};

export default EditableInteractiveImage;