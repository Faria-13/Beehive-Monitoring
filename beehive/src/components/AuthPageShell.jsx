import { Box, Paper, Typography } from "@mui/material";
import loginBg from "../assets/LogInBackground.png";

export default function AuthPageShell({
  title,
  subtitle,
  children,
  appTitle = "Beehive\nMonitoring",
  appSubtitle = "by DUBAI",
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        bgcolor: "#fbc139",
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4, md: 6 },
        py: { xs: 3, sm: 4 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "1400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 3, md: 6, lg: 10 },
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ flex: "0 1 420px", minWidth: 0 }}>
          <Typography
            fontFamily="Inter, sans-serif"
            fontWeight={800}
            fontSize="clamp(2.75rem, 7vw, 4.7rem)"
            lineHeight={1.05}
            color="black"
            whiteSpace="pre-line"
          >
            {appTitle}
          </Typography>

          <Typography
            fontFamily="Inter, sans-serif"
            fontWeight={600}
            fontSize="clamp(1.5rem, 4vw, 2.5rem)"
            color="black"
            mt={1}
          >
            {appSubtitle}
          </Typography>
        </Box>

        <Box sx={{ flex: "1 1 460px", minWidth: 0, display: "flex", justifyContent: "center" }}>
          <Paper
            elevation={0}
            sx={{
              width: "min(100%, 560px)",
              bgcolor: "#fbda7d",
              borderRadius: "11px",
              border: "2px solid black",
              p: { xs: 3, sm: 4 },
              boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
            }}
          >
            <Typography
              fontFamily="Poppins, sans-serif"
              fontWeight={700}
              fontSize={{ xs: 28, sm: 36 }}
              lineHeight={1.05}
              mb={1}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                fontFamily="Inter, sans-serif"
                fontSize={{ xs: 14, sm: 16 }}
                color="text.secondary"
                mb={3}
              >
                {subtitle}
              </Typography>
            )}

            {children}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
