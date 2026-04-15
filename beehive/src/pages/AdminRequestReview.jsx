import { useParams } from "react-router-dom";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AdminNavBar from "../components/AdminNavBar";

function ReviewSection({ title, children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
        p: 3,
      }}
    >
      <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize={22} mb={2}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export default function AdminRequestReview() {
  const { requestId } = useParams();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
      <AdminNavBar centerTitle={requestId ? `request ${requestId}` : "request review"} />

      <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 3, md: 4 }, maxWidth: 1100, mx: "auto" }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={500}
          fontSize={{ xs: 32, sm: 44, md: 60 }}
          textAlign="center"
          mb={{ xs: 2, sm: 3, md: 4 }}
        >
          request review
        </Typography>

        <Stack spacing={2.5}>
          <ReviewSection title="Request Info">
            <Stack spacing={1}>
              <Typography fontFamily="Inter, sans-serif" fontSize={15}>
                Name: Pending requester name
              </Typography>
              <Typography fontFamily="Inter, sans-serif" fontSize={15}>
                Email: pending@example.com
              </Typography>
              <Typography fontFamily="Inter, sans-serif" fontSize={15}>
                Organization / Farm: Not connected yet
              </Typography>
              <Typography fontFamily="Inter, sans-serif" fontSize={15}>
                Requested role: Standard user
              </Typography>
              <Typography fontFamily="Inter, sans-serif" fontSize={15}>
                Submitted: Pending timestamp
              </Typography>
            </Stack>
          </ReviewSection>

          <ReviewSection title="Access Reason">
            <Typography fontFamily="Inter, sans-serif" fontSize={15}>
              This section will display the requester’s submitted justification once the review page
              is connected to the request data source.
            </Typography>
          </ReviewSection>

          <ReviewSection title="Approval Setup">
            <Stack spacing={2}>
              <TextField
                select
                fullWidth
                label="Final Assigned Role"
                defaultValue="standard_user"
                size="small"
              >
                <MenuItem value="standard_user">Standard User</MenuItem>
                <MenuItem value="system_administrator">System Administrator</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label="Assigned Hive(s)"
                placeholder="Searchable hive selector to be added next"
                size="small"
              />

              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Internal Notes"
                placeholder="Review notes, approval reasoning, or requested follow-up"
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: "#fe5c05",
                    color: "#fff3d0",
                    textTransform: "none",
                    "&:hover": { bgcolor: "#e55204" },
                  }}
                >
                  Approve Request
                </Button>
                <Button
                  variant="outlined"
                  sx={{ borderColor: "black", color: "black", textTransform: "none" }}
                >
                  Request Changes
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ textTransform: "none" }}
                >
                  Reject Request
                </Button>
              </Stack>
            </Stack>
          </ReviewSection>
        </Stack>
      </Box>
    </Box>
  );
}
