import { ThemeProvider } from 'styled-components';
import { theme, GlobalStyle } from '../style';

const App = ({ Component, pageProps }) => (
  <ThemeProvider theme={theme}>
    <GlobalStyle />
    <Component {...pageProps} />
  </ThemeProvider>
);

export default App;
