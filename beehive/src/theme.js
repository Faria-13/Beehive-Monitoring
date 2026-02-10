import { createTheme } from "@mui/material/styles";

export const COLORS = {
  body: "#FFF9E9",
  text: "#1F0300",
  nav: "#FBC139", // swap to #FBDA7D anytime
  outline: "#1F0300",
  red: "#FE5C05",
  gold: "#FE9805",
  caption: "#C9C7BA",
};

const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: COLORS.body,
      paper: "#FFFFFF",
    },
    text: {
      primary: COLORS.text,
      secondary: COLORS.text,
    },
    primary: { main: COLORS.gold },
    secondary: { main: COLORS.red },
    divider: COLORS.outline,
  },
  typography: {
    fontFamily: `"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
    h1: { fontFamily: `"Poppins", sans-serif`, fontWeight: 500, fontSize: "40px" },
    h2: { fontFamily: `"Poppins", sans-serif`, fontWeight: 700, fontSize: "32px" },
    h3: { fontFamily: `"Inter", sans-serif`, fontWeight: 500, fontSize: "25px" },
    h4: { fontFamily: `"Inter", sans-serif`, fontWeight: 500, fontSize: "20px" },
    body1: { fontFamily: `"Inter", sans-serif`, fontWeight: 400, fontSize: "18px" },
    caption: { fontFamily: `"Inter", sans-serif`, fontWeight: 300, fontSize: "15px", color: COLORS.caption },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: COLORS.body,
          color: COLORS.text,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: COLORS.nav,
          color: COLORS.text,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `2px solid ${COLORS.outline}`,
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: COLORS.outline },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: COLORS.text } },
    },
  },
});

export default theme;
