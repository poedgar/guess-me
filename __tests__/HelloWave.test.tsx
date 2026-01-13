import { render } from '@testing-library/react-native';
import { HelloWave } from '../components/hello-wave';

// Simple test that focuses on basic rendering
describe('HelloWave', () => {
  it('renders correctly', () => {
    const { getByText } = render(<HelloWave />);
    
    expect(getByText('👋')).toBeTruthy();
  });

  it('has correct text content', () => {
    const { getByText } = render(<HelloWave />);
    
    expect(getByText('👋')).toBeTruthy();
  });

  it('can be rendered multiple times', () => {
    expect(() => {
      render(<HelloWave />);
      render(<HelloWave />);
    }).not.toThrow();
  });

  it('has no required props', () => {
    // Component should work without any props
    expect(() => {
      render(<HelloWave />);
    }).not.toThrow();
  });
});
