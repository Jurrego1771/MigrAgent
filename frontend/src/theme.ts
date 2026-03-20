import { createTheme, alpha } from '@mui/material/styles';

// Paleta extraída del diseño
export const COLORS = {
  neonGreen: '#03FA49',
  dustyRose: '#B86161',
  alertRed: '#F74545',
  sageGreen: '#64A275',
  mauve: '#785D5D',
  charcoal: '#424D45',
  darkBg: '#111511',
  darkPaper: '#191D19',
  darkCard: '#1F241F',
  darkBorder: '#2C322C',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: COLORS.neonGreen,
      light: '#4DFB78',
      dark: '#00C93A',
      contrastText: '#0A1A0A',
    },
    secondary: {
      main: COLORS.dustyRose,
      light: '#CC8080',
      dark: '#9A4F4F',
      contrastText: '#ffffff',
    },
    error: {
      main: COLORS.alertRed,
      light: '#F97070',
      dark: '#C73333',
    },
    warning: {
      main: '#F7A545',
      light: '#F9C070',
      dark: '#C47E1A',
    },
    success: {
      main: COLORS.sageGreen,
      light: '#82C098',
      dark: '#4A7D5A',
    },
    info: {
      main: COLORS.mauve,
      light: '#9A7A7A',
      dark: '#5A4444',
    },
    background: {
      default: COLORS.darkBg,
      paper: COLORS.darkPaper,
    },
    divider: COLORS.darkBorder,
    text: {
      primary: 'rgba(255,255,255,0.92)',
      secondary: 'rgba(255,255,255,0.50)',
      disabled: 'rgba(255,255,255,0.28)',
    },
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 600, letterSpacing: '0.02em' },
    caption: { letterSpacing: '0.04em' },
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${COLORS.charcoal} ${COLORS.darkBg}`,
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: COLORS.darkBg },
          '&::-webkit-scrollbar-thumb': {
            background: COLORS.charcoal,
            borderRadius: 4,
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
        containedPrimary: {
          color: '#0A1A0A',
          boxShadow: `0 0 16px ${alpha(COLORS.neonGreen, 0.35)}`,
          '&:hover': {
            boxShadow: `0 0 24px ${alpha(COLORS.neonGreen, 0.55)}`,
          },
        },
        outlinedPrimary: {
          borderColor: alpha(COLORS.neonGreen, 0.5),
          '&:hover': {
            borderColor: COLORS.neonGreen,
            background: alpha(COLORS.neonGreen, 0.06),
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${COLORS.darkBorder}`,
          backgroundImage: 'none',
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: COLORS.darkBorder },
            '&:hover fieldset': { borderColor: COLORS.charcoal },
            '&.Mui-focused fieldset': {
              borderColor: COLORS.neonGreen,
              boxShadow: `0 0 0 2px ${alpha(COLORS.neonGreen, 0.12)}`,
            },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
        bar: { borderRadius: 4 },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: COLORS.darkPaper,
          borderRight: `1px solid ${COLORS.darkBorder}`,
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha(COLORS.darkPaper, 0.92),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${COLORS.darkBorder}`,
          boxShadow: 'none',
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: COLORS.darkBorder },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          fontSize: '0.75rem',
          background: COLORS.charcoal,
        },
      },
    },
  },
});

export default theme;
