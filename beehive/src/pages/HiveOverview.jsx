//Page that lists all hives for the current user.

import { useEffect, useState } from "react";
import { supabase } from "../createClient";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

export default function HiveOverview() {
  const { user } = useAuth();

  const [appUser, setAppUser] = useState(null);
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1. Get app user (match by email)
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("email", user.email)
          .single();

        if (userError) throw userError;

        setAppUser(userData);

        // 2. Get hives for this user
        const { data: hiveData, error: hiveError } = await supabase
          .from("beehives")
          .select("*")
          .eq("owner_id", userData.user_id);

        if (hiveError) throw hiveError;

        setHives(hiveData ?? []);
      } catch (e) {
        setError(e.message || "Failed to load hives");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  if (loading) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <Stack spacing={3}>
        {/* Greeting */}
        <Typography variant="h4">
          Hello {appUser?.first_name || "User"}
        </Typography>

        {/* Hive list */}
        <Stack spacing={2}>
          {hives.length === 0 ? (
            <Typography>No hives found.</Typography>
          ) : (
            hives.map((hive) => (
              <Button
                key={hive.hive_id}
                component={Link}
                to={`/hives/${hive.hive_id}`}
                variant="outlined"
              >
                {hive.hive_code || `Hive ${hive.hive_id}`}
              </Button>
            ))
          )}
        </Stack>
      </Stack>
    </Box>
  );
}