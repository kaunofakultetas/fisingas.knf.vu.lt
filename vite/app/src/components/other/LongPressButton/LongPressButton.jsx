/**
 * LongPressButton - A button that requires holding for a duration to trigger action
 * 
 * Useful for dangerous/irreversible actions like delete operations.
 * Shows a circular progress indicator while being held.
 * 
 * Usage:
 *   <LongPressButton onComplete={handleDelete} color="error">
 *     <DeleteIcon sx={{ mr: 1 }} /> Delete
 *   </LongPressButton>
 * 
 *   <LongPressButton 
 *     onComplete={handleDangerousAction} 
 *     duration={5000}
 *     toastMessage="Hold for 5 seconds to confirm"
 *   >
 *     Dangerous Action
 *   </LongPressButton>
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, CircularProgress, Tooltip } from "@mui/material";
import toast from 'react-hot-toast';

const DEFAULT_DURATION = 3000; // 3 seconds






export default function LongPressButton({
  // Core functionality
  onComplete,              // Called when long press completes
  disabled = false,
  duration = DEFAULT_DURATION,
  
  // Button content
  children,                // Button content when not pressed
  pressedContent,          // Custom content while pressing (optional)
  
  // Appearance
  color = "error",         // MUI color: "primary" | "secondary" | "error" | "warning" | "info" | "success"
  variant = "contained",   // MUI variant: "contained" | "outlined" | "text"
  fullWidth = false,
  size = "medium",         // MUI size: "small" | "medium" | "large"
  sx = {},
  
  // Feedback
  completedToastMessage,
  uncompletedToastMessage,
  
  // Tooltip (shown on hover, works even when disabled)
  tooltip = "",
  
  // Progress indicator customization
  progressSize = 24,
  progressThickness = 4,
  progressColor = "white",
  progressBgColor = "rgba(255,255,255,0.3)",
  
  // Other props passed to Button
  ...buttonProps
}) {
  const [progress, setProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPressedRef = useRef(false);

  // Animation loop using requestAnimationFrame for smooth progress
  const animate = useCallback(() => {
    if (!isPressedRef.current || !startTimeRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min((elapsed / duration) * 100, 100);
    setProgress(newProgress);

    if (elapsed >= duration) {
      setIsPressed(false);
      isPressedRef.current = false;
      setProgress(0);
      if (completedToastMessage) {
        toast.success(<b>{completedToastMessage}</b>, { duration: 3000 });
      }
      onComplete?.();
      return;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [onComplete, duration, completedToastMessage]);

  // Start long press
  const startLongPress = useCallback((e) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();

    startTimeRef.current = Date.now();
    isPressedRef.current = true;
    setIsPressed(true);
    setProgress(0);
    animationRef.current = requestAnimationFrame(animate);
  }, [disabled, animate]);

  // Cancel long press
  const cancelLongPress = useCallback((e) => {
    if (!isPressedRef.current) return;
    e?.stopPropagation();

    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Show toast if released early
    if (elapsed > 0 && elapsed < duration && uncompletedToastMessage) {
      toast.error(<b>{uncompletedToastMessage}</b>, { duration: 3000 });
    }

    isPressedRef.current = false;
    setIsPressed(false);
    setProgress(0);
    startTimeRef.current = null;
  }, [duration, uncompletedToastMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Default pressed content - circular progress indicator
  const defaultPressedContent = (
    <div 
      style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: progressSize, 
        height: progressSize 
      }}
    >
      {/* Background circle */}
      <CircularProgress
        variant="determinate"
        value={100}
        size={progressSize}
        thickness={progressThickness}
        sx={{ 
          color: progressBgColor, 
          position: 'absolute' 
        }}
      />
      {/* Progress circle */}
      <CircularProgress
        variant="determinate"
        value={progress}
        size={progressSize}
        thickness={progressThickness}
        sx={{
          color: progressColor,
          position: 'absolute',
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
            transition: 'none', // Disable transition for smooth animation
          },
        }}
      />
    </div>
  );

  const button = (
    <Button
      variant={variant}
      color={color}
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu
      sx={{ 
        userSelect: 'none', // Prevent text selection while holding
        ...sx 
      }}
      {...buttonProps}
    >
      {isPressed ? (pressedContent || defaultPressedContent) : children}
    </Button>
  );

  if (!tooltip) return button;

  // span wrapper needed so Tooltip works on disabled buttons
  return (
    <Tooltip
      title={<span style={{ fontSize: '0.9rem' }}>{tooltip}</span>}
      arrow
      disableInteractive
      slotProps={{
        tooltip: { sx: { backgroundColor: 'black', py: 0.5, px: 1 } },
        arrow: { sx: { color: 'black' } },
      }}
    >
      <span style={{ display: 'flex', flex: 1, width: fullWidth ? '100%' : 'auto' }}>
        {button}
      </span>
    </Tooltip>
  );
}


/**
 * Preset: Delete button with long press
 */
export function LongPressDeleteButton({
  children,
  completedToastMessage,
  uncompletedToastMessage,
  ...props 
}) {
  return (
    <LongPressButton 
      color="error"
      completedToastMessage={completedToastMessage}
      uncompletedToastMessage={uncompletedToastMessage}
      {...props}
    >
      {children}
    </LongPressButton>
  );
}
