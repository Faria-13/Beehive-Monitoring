import { useLocation, useNavigate } from "react-router-dom";
import { Button, Stack, Typography } from "@mui/material";
import AuthPageShell from "../components/AuthPageShell";

export default function AccountPending() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  return (
    <AuthPageShell
      title="Account Pending Review"
      subtitle="Your request has been received, but your account is not ready yet."
    >
      <Stack spacing={3}>
        <Typography fontFamily="Inter, sans-serif" fontSize={16}>
          {email
            ? `We found a request for ${email}.`
            : "We found your sign-in attempt, but your account is still pending review."}
        </Typography>

        <Typography fontFamily="Inter, sans-serif" fontSize={16}>
          Please watch your email for approval and setup instructions. Reviews usually take 2-3 business
          days, and approved accounts are typically set up within 1 business day after review.
        </Typography>

        <Button
          variant="contained"
          onClick={() => navigate("/login")}
          sx={{
            alignSelf: "flex-start",
            bgcolor: "#fe5c05",
            color: "#fff3d0",
            textTransform: "none",
            "&:hover": { bgcolor: "#e55204" },
          }}
        >
          Back to Login
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
