import React from "react";
import {
  Box,
  Button,
  InputBase,
  Paper,
  Typography,
} from "@mui/material";

export default function LoginUI({
  activeTab = "login",
  emailValue = "",
  passwordValue = "",
  onTabChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  appTitle = "Beehive\nMonitoring",
  appSubtitle = "by DUBAI",
}) {
  const isLogin = activeTab === "login";

  const leftPanelColor = isLogin ? "#fbda7d" : "#feecb8";
  const rightPanelColor = isLogin ? "#feecb8" : "#fbda7d";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        bgcolor: "#fbc139",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4, md: 6 },
        py: { xs: 3, sm: 4 },
        overflow: "hidden",
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
        <Box
          sx={{
            flex: "0 1 420px",
            minWidth: 0,
          }}
        >
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

        <Box
          sx={{
            flex: "1 1 420px",
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "min(100%, 500px)",
              aspectRatio: "500 / 650",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                right: 0,
                top: "3.8%",
                width: "54.4%",
                height: "21.2%",
                bgcolor: rightPanelColor,
                borderRadius: "11px",
                transition: "background-color 0.2s ease",
              }}
            />

            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: "2.5%",
                width: "50%",
                height: "18.3%",
                bgcolor: leftPanelColor,
                borderRadius: "11px",
                boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
                transition: "background-color 0.2s ease",
              }}
            />

            <Paper
              elevation={0}
              sx={{
                position: "absolute",
                left: 0,
                top: "16%",
                width: "100%",
                height: "82.6%",
                bgcolor: "#fbda7d",
                borderRadius: "11px",
              }}
            />

              <Box
                sx={{
                  position: "absolute",
                  top: "5.8%",
                  left: 0,
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",  // 👈 key change
                  px: "6%",
                }}
              >
              {["login", "signup"].map((tab) => {
                const isActive = activeTab === tab;

                return (
                  <Typography
                    key={tab}
                    component="span"
                    fontFamily="Inter, sans-serif"
                    fontWeight={700}
                    fontSize="clamp(2rem, 4vw, 3.125rem)"
                    color={isActive ? "black" : "rgba(0,0,0,0.5)"}
                    sx={{
                      textDecoration: isActive ? "underline" : "none",
                      cursor: "pointer",
                      userSelect: "none",
                      "&:hover": { opacity: 0.8 },
                    }}
                    onClick={() => onTabChange?.(tab)}
                  >
                    {tab === "login" ? "Login" : "Sign up"}
                  </Typography>
                );
              })}
            </Box>

            <Box
              sx={{
                position: "absolute",
                top: "33.5%",
                left: 0,
                width: "100%",
              }}
            >
              <Typography
                fontFamily="Inter, sans-serif"
                fontWeight={500}
                fontSize="clamp(1.1rem, 2.2vw, 1.56rem)"
                sx={{ mb: 0.5, ml: "6.6%" }}
              >
                Email
              </Typography>

              <Box
                sx={{
                  mx: "auto",
                  width: "88.6%",
                  height: "63px",
                  bgcolor: "#fff3d0",
                  border: "2px solid black",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                }}
              >
                <InputBase
                  fullWidth
                  value={emailValue}
                  onChange={(e) => onEmailChange?.(e.target.value)}
                  inputProps={{ "aria-label": "email" }}
                  sx={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                  }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                position: "absolute",
                top: "57.8%",
                left: 0,
                width: "100%",
              }}
            >
              <Typography
                fontFamily="Inter, sans-serif"
                fontWeight={500}
                fontSize="clamp(1.1rem, 2.2vw, 1.56rem)"
                sx={{ mb: 0.5, ml: "7.2%" }}
              >
                Password
              </Typography>

              <Box
                sx={{
                  mx: "auto",
                  width: "88.6%",
                  height: "63px",
                  bgcolor: "#fff3d0",
                  border: "2px solid black",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                }}
              >
                <InputBase
                  fullWidth
                  type="password"
                  value={passwordValue}
                  onChange={(e) => onPasswordChange?.(e.target.value)}
                  inputProps={{ "aria-label": "password" }}
                  sx={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                  }}
                />
              </Box>
            </Box>

            <Button
              variant="contained"
              onClick={onSubmit}
              sx={{
                position: "absolute",
                top: "82.2%",
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "#fe5c05",
                color: "#fff3d0",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: "clamp(1.15rem, 2.2vw, 1.56rem)",
                textTransform: "none",
                borderRadius: "7px",
                px: 4,
                py: 1.75,
                lineHeight: 1,
                "&:hover": { bgcolor: "#e55204" },
              }}
            >
              {activeTab === "login" ? "Login" : "Sign up"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}