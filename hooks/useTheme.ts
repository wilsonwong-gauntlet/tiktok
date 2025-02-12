import { useColorScheme } from 'react-native';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: {
      primary: '#9580FF',
      background: isDark ? '#111' : '#fff',
      card: isDark ? '#1a1a1a' : '#f5f5f5',
      text: isDark ? '#fff' : '#000',
      border: isDark ? '#222' : '#e5e5e5',
      notification: '#FF453A',
      success: '#30D158',
      warning: '#FF9500',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  };
}; 