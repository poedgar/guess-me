import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Simple test component that doesn't require assets
const SimpleComponent = () => {
  return (
    <View testID="simple-component">
      <Text>Hello World</Text>
    </View>
  );
};

describe('SimpleComponent', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<SimpleComponent />);
    
    // Test that the component renders without crashing
    expect(getByTestId('simple-component')).toBeTruthy();
  });

  it('contains correct text', () => {
    const { getByText } = render(<SimpleComponent />);
    
    // Test that the component contains the expected text
    expect(getByText('Hello World')).toBeTruthy();
  });
});
