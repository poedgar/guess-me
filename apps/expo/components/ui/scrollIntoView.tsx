// Same .tsx extension as the .web.tsx file on purpose: Metro tries extensions in
// order and would pick a plain .ts file before ever trying .web.tsx.
// Native: use react-native-scroll-into-view as-is.
// Web uses scrollIntoView.web.tsx instead, because the library relies on
// findNodeHandle, which react-native-web no longer supports.
export { ScrollIntoView, wrapScrollView } from 'react-native-scroll-into-view';
