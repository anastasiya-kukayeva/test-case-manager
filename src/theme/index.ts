import { createTheme, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#eef6ff',
  '#d9eaff',
  '#b0d4ff',
  '#84bdff',
  '#5ea9ff',
  '#479bff',
  '#3894ff',
  '#2880e6',
  '#1a72cf',
  '#0062b8',
];

export const appTheme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand,
  },
  fontFamily:
    'Segoe UI, Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif',
  defaultRadius: 'lg',
  // Softer, more rounded shadows (larger blur, lighter spread)
  shadows: {
    xs: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 2px 8px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.05)',
    md: '0 6px 18px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)',
    lg: '0 12px 28px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.06)',
    xl: '0 20px 40px rgba(15, 23, 42, 0.14), 0 8px 16px rgba(15, 23, 42, 0.07)',
  },
  radius: {
    xs: '0.35rem',
    sm: '0.55rem',
    md: '0.85rem',
    lg: '1.15rem',
    xl: '1.6rem',
  },
  headings: {
    fontWeight: '600',
  },
  components: {
    AppShell: {
      defaultProps: {
        padding: 'md',
      },
    },
    Button: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: 'var(--mantine-radius-md)',
        },
      },
    },
  },
});
