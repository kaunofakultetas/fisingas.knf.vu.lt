/**
 * UniversalModal - A flexible, reusable modal dialog component
 * 
 * Usage Examples:
 * 
 * 1. Simple confirmation dialog:
 *    <UniversalModal
 *      open={open}
 *      onClose={() => setOpen(false)}
 *      title="Delete Item"
 *      description="Are you sure you want to delete this item?"
 *      variant="danger"
 *      confirmText="Delete"
 *      onConfirm={handleDelete}
 *    />
 * 
 * 2. With custom content:
 *    <UniversalModal
 *      open={open}
 *      onClose={() => setOpen(false)}
 *      title="Edit User"
 *    >
 *      <TextField label="Name" />
 *      <TextField label="Email" />
 *    </UniversalModal>
 * 
 * 3. With custom actions (rendered full-width in a block container):
 *    <UniversalModal
 *      open={open}
 *      onClose={() => setOpen(false)}
 *      title="Edit Item"
 *      showCancel={false}
 *      showConfirm={false}
 *      actions={
 *        <div style={{ display: 'flex', gap: '8px' }}>
 *          <Button fullWidth onClick={handleSave}>Save</Button>
 *          <LongPressDeleteButton onComplete={handleDelete} fullWidth />
 *        </div>
 *      }
 *    >
 *      {content}
 *    </UniversalModal>
 */

import {
  Modal,
  Paper,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Divider,
} from "@mui/material";

import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';


// Variant configurations
const VARIANTS = {
  default: {
    icon: null,
    confirmColor: "primary",
    iconColor: "primary",
  },
  danger: {
    icon: ErrorOutlineIcon,
    confirmColor: "error",
    iconColor: "error",
  },
  warning: {
    icon: WarningAmberIcon,
    confirmColor: "warning",
    iconColor: "warning",
  },
  info: {
    icon: InfoOutlinedIcon,
    confirmColor: "info",
    iconColor: "info",
  },
  success: {
    icon: CheckCircleOutlineIcon,
    confirmColor: "success",
    iconColor: "success",
  },
};


export default function UniversalModal({
  // Control
  open,
  onClose,
  
  // Content
  title,
  description,
  children,
  
  // Actions - custom JSX for buttons (overrides confirm/cancel)
  actions,
  
  // Standard action buttons (used when 'actions' prop is not provided)
  confirmText = "Patvirtinti",
  cancelText = "Atšaukti",
  onConfirm,
  onCancel,
  showCancel = true,
  showConfirm = true,
  confirmDisabled = false,
  
  // Variants: "default" | "danger" | "warning" | "info" | "success"
  variant = "default",
  
  // Sizing
  maxWidth = 500,
  fullWidth = false,
  
  // Loading state
  loading = false,
  
  // Behavior
  closeOnConfirm = true,
  closeOnBackdropClick = true,
  showCloseButton = true,
  
  // Custom styling
  sx = {},
  contentSx = {},
}) {
  
  const variantConfig = VARIANTS[variant] || VARIANTS.default;
  const VariantIcon = variantConfig.icon;

  // Handle confirm action
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    if (closeOnConfirm) {
      onClose?.();
    }
  };

  // Handle cancel action
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose?.();
  };

  // Handle backdrop click
  const handleBackdropClick = (event, reason) => {
    if (reason === 'backdropClick' && !closeOnBackdropClick) {
      return;
    }
    onClose?.();
  };

  // Determine if we should show the action bar
  const showActionBar = actions || showConfirm || showCancel;

  return (
    <Modal 
      open={open} 
      onClose={handleBackdropClick}
      aria-labelledby="universal-modal-title"
      aria-describedby="universal-modal-description"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(6px)',
          },
        },
      }}
    >
      <Paper
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: fullWidth ? '90%' : 'auto',
          maxWidth: maxWidth,
          minWidth: 300,
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 2,
          boxShadow: 24,
          outline: 'none',
          ...sx,
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            p: 3,
            pb: description || children ? 2 : 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, marginBottom: 1 }}>
            {VariantIcon && (
              <VariantIcon 
                color={variantConfig.iconColor} 
                sx={{ fontSize: 28 }} 
              />
            )}
            <Box>
              {title && (
                <Typography 
                  id="universal-modal-title"
                  variant="h6" 
                  component="h2"
                  sx={{ fontWeight: 600 }}
                >
                  {title}
                </Typography>
              )}
              {description && (
                <Typography 
                  id="universal-modal-description"
                  variant="body2" 
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {description}
                </Typography>
              )}
            </Box>
          </Box>
          
          {showCloseButton && (
            <IconButton 
              onClick={onClose} 
              size="small"
              sx={{ 
                ml: 1,
                color: 'text.secondary',
                '&:hover': { color: 'error.main' }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Content */}
        {children && (
          <Box sx={{ px: 3, pb: showActionBar ? 2 : 3, ...contentSx }}>
            {children}
          </Box>
        )}

        {/* Custom Actions - block layout for full-width support */}
        {actions && (
          <>
            <Divider />
            <Box sx={{ p: 2, px: 3 }}>
              {actions}
            </Box>
          </>
        )}

        {/* Standard Confirm/Cancel Buttons - flex layout, right-aligned */}
        {!actions && (showConfirm || showCancel) && (
          <>
            <Divider />
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end',
                gap: 1.5, 
                p: 2,
                px: 3,
              }}
            >
              {showCancel && (
                <Button 
                  variant="outlined" 
                  onClick={handleCancel}
                  disabled={loading}
                >
                  {cancelText}
                </Button>
              )}
              {showConfirm && (
                <Button
                  variant="contained"
                  color={variantConfig.confirmColor}
                  onClick={handleConfirm}
                  disabled={confirmDisabled || loading}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {confirmText}
                </Button>
              )}
            </Box>
          </>
        )}
      </Paper>
    </Modal>
  );
}


/**
 * Preset modal types for common use cases
 */

// Confirmation dialog preset
export function ConfirmModal({ 
  title = "Patvirtinti veiksmą",
  confirmText = "Patvirtinti",
  ...props 
}) {
  return (
    <UniversalModal 
      title={title}
      confirmText={confirmText}
      showCancel={true}
      {...props} 
    />
  );
}

// Delete confirmation preset
export function DeleteModal({ 
  title = "Ištrinti",
  description = "Ar tikrai norite ištrinti? Šis veiksmas negrįžtamas.",
  confirmText = "Ištrinti",
  ...props 
}) {
  return (
    <UniversalModal 
      title={title}
      description={description}
      confirmText={confirmText}
      variant="danger"
      {...props} 
    />
  );
}

// Info/Alert modal preset
export function AlertModal({ 
  title = "Informacija",
  confirmText = "Gerai",
  showCancel = false,
  ...props 
}) {
  return (
    <UniversalModal 
      title={title}
      confirmText={confirmText}
      showCancel={showCancel}
      variant="info"
      {...props} 
    />
  );
}

// Warning modal preset
export function WarningModal({ 
  title = "Įspėjimas",
  confirmText = "Supratau",
  ...props 
}) {
  return (
    <UniversalModal 
      title={title}
      confirmText={confirmText}
      variant="warning"
      {...props} 
    />
  );
}
