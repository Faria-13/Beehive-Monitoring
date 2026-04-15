import { useLocation, useNavigate } from "react-router-dom";
import { Button, Stack, Typography } from "@mui/material";
import AuthPageShell from "../components/AuthPageShell";

export default function SignupSubmitted() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? "your email address";

  return (
    <AuthPageShell
      title="Request Submitted"
      subtitle="Your sign-up form was submitted successfully."
    >
      <Stack spacing={3}>
        <Typography fontFamily="Inter, sans-serif" fontSize={16}>
          A confirmation email will be sent to <strong>{email}</strong>. Please check your inbox for
          further directions.
        </Typography>

        <Typography fontFamily="Inter, sans-serif" fontSize={16}>
          Requests are typically reviewed within 2-3 business days. If approved, your account setup
          instructions will be sent within 1 business day after approval.
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
          Return to Login
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
