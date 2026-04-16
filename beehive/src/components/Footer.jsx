import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Logo from "../assets/DubaiLogo.png";

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        py: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        backgroundColor: "#fbc139",
      }}
    >
      <Box
        component="img"
        src={Logo}
        alt="Dubai Team Logo"
        sx={{ height: 125, width: "auto" }}
      />
      <Typography variant="body1" sx={{ color: "#fff", mt: 0.5, fontWeight: 700 }}>
        ds6953@g.rit.edu
      </Typography>
    </Box>
  );
}
