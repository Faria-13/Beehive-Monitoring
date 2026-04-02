import { useEffect, useState } from "react";
import { supabase } from "../createClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/hives", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate("/hives", { replace: true });
    setLoading(false);
  };

  if (authLoading) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ width: 320 }}>
        <Stack spacing={2}>
          <Typography variant="h4" textAlign="center">
            Beehive Monitoring
          </Typography>

          <Typography variant="subtitle1" textAlign="center">
            by DUBAI
          </Typography>

          <form onSubmit={handleLogin}>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />

              {error && (
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                fullWidth
              >
                {loading ? "Logging in..." : "Log In"}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Box>
    </Box>
  );
}