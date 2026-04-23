import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
 
serve(async (req: Request) => {
  try {
    const { message } = await req.json();
 
    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 });
    }
 
    const gatewayUrl = Deno.env.get("SMS_GATEWAY_URL")!;
    const username   = Deno.env.get("SMS_GATEWAY_USER")!;
    const password   = Deno.env.get("SMS_GATEWAY_PASS")!;
    const toPhone    = Deno.env.get("BEEKEEPER_PHONE")!;
 
    const response = await fetch(`${gatewayUrl}/message`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${username}:${password}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumbers: [toPhone],
        message: `🐝 BEEHIVE ALERT: ${message}`,
      }),
    });
 
    if (!response.ok) {
      const err = await response.text();
      console.error("SMS gateway error:", err);
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }
 
    const result = await response.json();
    console.log("SMS sent:", result);
    return new Response(JSON.stringify({ status: "sent", result }), { status: 200 });
 
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});