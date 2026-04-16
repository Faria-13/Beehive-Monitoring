import { Link } from "react-router-dom";
import {
  Box,
  Button,
  InputBase,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import AdminNavBar from "../components/AdminNavBar";

function InfoPill({ label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 2,
        py: 1.25,
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
      }}
    >
      <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize={14}>
        {label}: {value}
      </Typography>
    </Paper>
  );
}

function RequestCard({ title, description, actionLabel, to }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
        p: 3,
        boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize={22}>
            {title}
          </Typography>
          <Typography fontFamily="Inter, sans-serif" fontSize={14} color="text.secondary" mt={0.75}>
            {description}
          </Typography>
        </Box>

        <Button
          component={Link}
          to={to}
          variant="contained"
          endIcon={<ArrowRightIcon />}
          sx={{
            alignSelf: "flex-start",
            bgcolor: "#fe5c05",
            color: "#fff3d0",
            textTransform: "none",
            "&:hover": { bgcolor: "#e55204" },
          }}
        >
          {actionLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

export default function AdminPendingRequests() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
      <AdminNavBar />

      <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 3, md: 4 } }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={500}
          fontSize={{ xs: 32, sm: 44, md: 60 }}
          textAlign="center"
          mb={{ xs: 2, sm: 3, md: 4 }}
        >
          pending requests
        </Typography>

        <Stack
          useFlexGap
          direction="row"
          spacing={{ xs: 1, sm: 2, md: 3 }}
          rowGap={{ xs: 1.5, sm: 2, md: 2.5 }}
          justifyContent="center"
          flexWrap="wrap"
          mb={{ xs: 3, sm: 4, md: 4 }}
        >
          <InfoPill label="Pending Requests" value="0" />
          <InfoPill label="Approved Today" value="0" />
          <InfoPill label="Rejected Today" value="0" />
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mx: "auto",
            maxWidth: 866,
            height: 50,
            bgcolor: "white",
            border: "2px solid black",
            borderRadius: "6px",
            px: 2,
            gap: 1,
            mb: 3,
          }}
        >
          <SearchIcon sx={{ color: "#d9d9d9", flexShrink: 0 }} />
          <InputBase
            fullWidth
            placeholder="Search pending requests…"
            sx={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: { xs: 14, sm: 16 },
              color: "black",
              "& ::placeholder": { color: "black", opacity: 1 },
            }}
          />
        </Box>

        <Stack spacing={2} sx={{ maxWidth: 980, mx: "auto" }}>
          <RequestCard
            title="Approval Queue"
            description="This page will list access requests submitted by prospective users, including their name, email, organization, requested role, and justification."
            actionLabel="Open Review Layout"
            to="/admin/requests/preview"
          />

          <Paper
            variant="outlined"
            sx={{
              bgcolor: "#fff9e9",
              border: "2px solid black",
              borderRadius: "11px",
              p: 3,
            }}
          >
            <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize={22} mb={1.5}>
              No Requests Connected Yet
            </Typography>
            <Typography fontFamily="Inter, sans-serif" fontSize={15}>
              The admin request queue has been scaffolded. The next step is wiring this page to an
              `access_requests` table so pending requests can populate here instead of showing this
              placeholder state.
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
