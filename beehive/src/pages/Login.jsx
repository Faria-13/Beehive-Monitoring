import { useEffect, useState } from "react";
import { supabase } from "../createClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LoginUI from "../components/LoginUI";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function redirectIfLoggedIn() {
      if (!authLoading && user) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type, account_status")
          .eq("email", user.email)
          .maybeSingle();

        if (userError || !userData) {
          navigate("/account-pending", {
            replace: true,
            state: { email: user.email },
          });
          return;
        }

        if (userData.account_status && userData.account_status !== "active") {
          navigate("/account-pending", {
            replace: true,
            state: { email: user.email },
          });
          return;
        }

        if (userData.user_type === "system_administrator") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/hives", { replace: true });
        }
      }
    }

    redirectIfLoggedIn();
  }, [user, authLoading, navigate]);

  const handleLogin = async () => {
    if (activeTab !== "login") {
      navigate("/request-access");
      return;
    }

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

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_type, account_status")
      .eq("email", email)
      .maybeSingle();

    if (userError || !userData) {
      await supabase.auth.signOut();
      navigate("/account-pending", {
        replace: true,
        state: { email },
      });
      setLoading(false);
      return;
    }

    if (userData.account_status && userData.account_status !== "active") {
      await supabase.auth.signOut();
      navigate("/account-pending", {
        replace: true,
        state: { email },
      });
      setLoading(false);
      return;
    }

    if (userData.user_type === "system_administrator") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/hives", { replace: true });
    }

    setLoading(false);
  };

  if (authLoading) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }

  return (
    <>
      <LoginUI
        activeTab={activeTab}
        emailValue={email}
        passwordValue={password}
        onTabChange={setActiveTab}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        appTitle={"Beehive\nMonitoring"}
        appSubtitle="by DUBAI"
      />

      {error && (
        <Box sx={{ position: "fixed", bottom: 24, left: 24, zIndex: 2000 }}>
          <Typography
            color="error"
            variant="body2"
            sx={{
              bgcolor: "white",
              px: 2,
              py: 1,
              borderRadius: 1,
              boxShadow: 2,
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </>
  );
}
