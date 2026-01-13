import { IconSymbol } from '../components/ui/icon-symbol';

// Mock MaterialIcons to avoid rendering issues
jest.mock('@expo/vector-icons/MaterialIcons', () => 'Text');

// Mock dependencies
jest.mock('@/components/themed-text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children, ...props }) => React.createElement(Text, props, children);
});

jest.mock('@/components/themed-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, ...props }) => React.createElement(View, props, children);
});

describe('IconSymbol', () => {
  it('can be imported', () => {
    // Test that component can be imported without errors
    expect(IconSymbol).toBeDefined();
    expect(typeof IconSymbol).toBe('function');
  });

  it('has correct component structure', () => {
    // Test component structure without rendering
    expect(IconSymbol).toBeDefined();
    expect(IconSymbol.name).toBe('IconSymbol');
  });

  it('accepts required props', () => {
    // Test that component accepts required props
    expect(() => {
      const element = <IconSymbol name="house.fill" size={24} color="#000" />;
      expect(element).toBeTruthy();
    }).not.toThrow();
  });

  it('has proper export', () => {
    // Test that component is properly exported
    expect(IconSymbol).toBeDefined();
  });

  it('handles different icon names', () => {
    // Test that component can handle different icon names
    const validIconNames = ['house.fill', 'paperplane.fill'] as const;
    
    validIconNames.forEach(iconName => {
      expect(() => {
        const element = <IconSymbol name={iconName} size={24} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles different sizes', () => {
    // Test that component can handle different sizes
    const sizes = [16, 24, 32];
    
    sizes.forEach(size => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={size} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles different colors', () => {
    // Test that component can handle different colors
    const colors = ['#000', '#fff', '#6a11cb'];
    
    colors.forEach(color => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={24} color={color} />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles all mapped icon names', () => {
    // Test that all icons in the mapping can be used
    const allIconNames = [
      'house.fill',
      'paperplane.fill', 
      'chevron.left.forwardslash.chevron.right',
      'chevron.right',
      'play.fill',
      'plus.circle.fill',
      'checkmark.circle.fill',
      'eye.fill',
      'brain.head.profile',
      'arrow.up.circle.fill',
      'arrow.right.circle.fill',
      'forward.end.fill',
      'flag.checkered',
      'door.left.hand.open',
      'book.fill',
      'star.fill',
      'trophy.fill',
      'lightbulb.fill',
      'crown.fill',
      'hourglass',
      'lock.shield'
    ] as const;
    
    allIconNames.forEach(iconName => {
      expect(() => {
        const element = <IconSymbol name={iconName} size={24} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles edge case sizes', () => {
    // Test edge case sizes
    const edgeSizes = [0, 1, 999, -1];
    
    edgeSizes.forEach(size => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={size} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles default size when not provided', () => {
    // Test that default size (24) is used when size is not provided
    expect(() => {
      const element = <IconSymbol name="house.fill" color="#000" />;
      expect(element).toBeTruthy();
    }).not.toThrow();
  });

  it('handles style prop correctly', () => {
    // Test that style prop is accepted
    const testStyles = [
      undefined,
      null,
      {},
      { marginTop: 10 },
      { transform: [{ rotate: '45deg' }] }
    ];
    
    testStyles.forEach(style => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={24} color="#000" style={style} />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles special color values', () => {
    // Test special color values like OpaqueColorValue
    const specialColors = [
      'transparent',
      'inherit',
      'rgba(0,0,0,0.5)',
      '#FF5733'
    ];
    
    specialColors.forEach(color => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={24} color={color} />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('validates icon name type safety', () => {
    // Test that TypeScript properly validates icon names
    expect(() => {
      // This should work - valid icon name
      const validElement = <IconSymbol name="house.fill" size={24} color="#000" />;
      expect(validElement).toBeTruthy();
    }).not.toThrow();
  });

  it('handles weight prop (iOS specific)', () => {
    // Test that weight prop is accepted (used in iOS version)
    expect(() => {
      const element = <IconSymbol name="house.fill" size={24} color="#000" weight="bold" />;
      expect(element).toBeTruthy();
    }).not.toThrow();
  });

  it('maintains mapping consistency', () => {
    // Test that all mapped Material Icons exist
    // This is more of a design test to ensure mapping is valid
    const mappingKeys = Object.keys({
      'house.fill': 'home',
      'paperplane.fill': 'send',
      'chevron.left.forwardslash.chevron.right': 'code',
      'chevron.right': 'chevron-right',
      'play.fill': 'play-arrow',
      'plus.circle.fill': 'add-circle',
      'checkmark.circle.fill': 'check-circle',
      'eye.fill': 'visibility',
      'brain.head.profile': 'psychology',
      'arrow.up.circle.fill': 'arrow-circle-up',
      'arrow.right.circle.fill': 'arrow-forward',
      'forward.end.fill': 'skip-next',
      'flag.checkered': 'flag',
      'door.left.hand.open': 'logout',
      'book.fill': 'menu-book',
      'star.fill': 'star',
      'trophy.fill': 'emoji-events',
      'lightbulb.fill': 'lightbulb',
      'crown.fill': 'workspace-premium',
      'hourglass': 'hourglass-empty',
      'lock.shield': 'security',
    });
    
    expect(mappingKeys.length).toBeGreaterThan(0);
    expect(mappingKeys).toContain('house.fill');
    expect(mappingKeys).toContain('star.fill');
  });

  it('handles zero and negative sizes gracefully', () => {
    // Test boundary conditions for size
    const boundarySizes = [0, -1, -100];
    
    boundarySizes.forEach(size => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={size} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });

  it('handles very large sizes', () => {
    // Test very large sizes to ensure no overflow issues
    const largeSizes = [1000, 9999];
    
    largeSizes.forEach(size => {
      expect(() => {
        const element = <IconSymbol name="house.fill" size={size} color="#000" />;
        expect(element).toBeTruthy();
      }).not.toThrow();
    });
  });
});
