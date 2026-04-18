import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AuthPageShell from "../components/AuthPageShell";

export default function RequestAccess() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    affiliation: "",
    reason: "",
  });

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/signup-submitted", {
      replace: true,
      state: { email: form.email.trim() },
    });
  }

  return (
    <AuthPageShell
      title="Request Access"
      subtitle="Submit a request to join the Beehive Monitoring system. Requests are reviewed within 2-3 business days."
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="First Name"
              value={form.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              required
              size="small"
            />
            <TextField
              fullWidth
              label="Last Name"
              value={form.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              required
              size="small"
            />
          </Stack>

          <TextField
            fullWidth
            type="email"
            label="Email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
            size="small"
          />

          <TextField
            fullWidth
            label="Phone Number"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            size="small"
          />

          <TextField
            fullWidth
            label="Organization / Affiliation"
            value={form.affiliation}
            onChange={(e) => updateField("affiliation", e.target.value)}
            size="small"
          />

          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Reason for Access"
            value={form.reason}
            onChange={(e) => updateField("reason", e.target.value)}
            required
          />

          <Box
            sx={{
              border: "2px solid black",
              borderRadius: "10px",
              bgcolor: "#fff3d0",
              px: 2,
              py: 1.5,
            }}
          >
            <Typography fontFamily="Inter, sans-serif" fontSize={14}>
              After you submit this form, a confirmation email will be sent to the address you provided.
              If approved, your account setup instructions will follow within 1 business day after review.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => navigate("/login")}
              sx={{ borderColor: "black", color: "black", textTransform: "none" }}
            >
              Back to Login
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                bgcolor: "#fe5c05",
                color: "#fff3d0",
                textTransform: "none",
                "&:hover": { bgcolor: "#e55204" },
              }}
            >
              Submit Request
            </Button>
          </Stack>
        </Stack>
      </Box>
    </AuthPageShell>
  );
}
