import { useNavigate } from "react-router-dom";
import { Button, Stack, Typography } from "@mui/material";
import AuthPageShell from "../components/AuthPageShell";

export default function AccountReady() {
  const navigate = useNavigate();

  return (
    <AuthPageShell
      title="Account Ready"
      subtitle="Your account has been approved and set up."
    >
      <Stack spacing={3}>
        <Typography fontFamily="Inter, sans-serif" fontSize={16}>
          Your Beehive Monitoring account is ready. You can now sign in using the email address tied
          to your approved request.
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
          Go to Login
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
