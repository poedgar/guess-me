import { Platform, StyleSheet } from 'react-native';

export const globalStyles = StyleSheet.create({
  // Global text styles
  text: {
    fontFamily: Platform.select({
      ios: 'Philosopher-Regular',
      android: 'Philosopher-Regular',
      web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      default: 'Philosopher-Regular',
    }),
  },
  
  // Specific text components
  heading: {
    fontFamily: Platform.select({
      ios: 'Philosopher-Regular',
      android: 'Philosopher-Regular',
      web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      default: 'Philosopher-Regular',
    }),
    fontSize: 24,
    fontWeight: 'normal',
  },
  
  subheading: {
    fontFamily: Platform.select({
      ios: 'Philosopher-Regular',
      android: 'Philosopher-Regular',
      web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      default: 'Philosopher-Regular',
    }),
    fontSize: 18,
    fontWeight: 'normal',
  },
  
  body: {
    fontFamily: Platform.select({
      ios: 'Philosopher-Regular',
      android: 'Philosopher-Regular',
      web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      default: 'Philosopher-Regular',
    }),
    fontSize: 16,
  },
  
  caption: {
    fontFamily: Platform.select({
      ios: 'Philosopher-Regular',
      android: 'Philosopher-Regular',
      web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      default: 'Philosopher-Regular',
    }),
    fontSize: 12,
  },
});

// Helper function to apply Philosopher font to any style
export const withPhilosopherFont = (style: any = {}) => ({
  fontFamily: Platform.select({
    ios: 'Philosopher-Regular',
    android: 'Philosopher-Regular',
    web: 'Philosopher-Regular, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    default: 'Philosopher-Regular',
  }),
  ...style,
});
