import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, CircularProgress, Tooltip } from "@mui/material";
import toast from 'react-hot-toast';

const DEFAULT_DURATION = 3000;

export default function LongPressButton({
  onComplete,
  disabled = false,
  duration = DEFAULT_DURATION,
  children,
  pressedContent,
  color = "error",
  variant = "contained",
  fullWidth = false,
  size = "medium",
  sx = {},
  completedToastMessage,
  uncompletedToastMessage,
  tooltip = "",
  progressSize = 24,
  progressThickness = 4,
  progressColor = "white",
  progressBgColor = "rgba(255,255,255,0.3)",
  ...buttonProps
}) {
  const [progress, setProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPressedRef = useRef(false);

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

  const cancelLongPress = useCallback((e) => {
    if (!isPressedRef.current) return;
    e?.stopPropagation();

    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (elapsed > 0 && elapsed < duration && uncompletedToastMessage) {
      toast.error(<b>{uncompletedToastMessage}</b>, { duration: 3000 });
    }

    isPressedRef.current = false;
    setIsPressed(false);
    setProgress(0);
    startTimeRef.current = null;
  }, [duration, uncompletedToastMessage]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const defaultPressedContent = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: progressSize, height: progressSize }}>
      <CircularProgress variant="determinate" value={100} size={progressSize} thickness={progressThickness} sx={{ color: progressBgColor, position: 'absolute' }} />
      <CircularProgress variant="determinate" value={progress} size={progressSize} thickness={progressThickness} sx={{ color: progressColor, position: 'absolute', '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'none' } }} />
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
      onContextMenu={(e) => e.preventDefault()}
      sx={{ userSelect: 'none', ...sx }}
      {...buttonProps}
    >
      {isPressed ? (pressedContent || defaultPressedContent) : children}
    </Button>
  );

  if (!tooltip) return button;

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

export function LongPressDeleteButton({ children, completedToastMessage, uncompletedToastMessage, ...props }) {
  return (
    <LongPressButton color="error" completedToastMessage={completedToastMessage} uncompletedToastMessage={uncompletedToastMessage} {...props}>
      {children}
    </LongPressButton>
  );
}
