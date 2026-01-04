import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("Webhook InvictusPay recebido:", body);

    const transactionHash = body.transaction_hash ?? body.hash;
    const status = body.status ?? body.transaction_status;
    const amount = body.amount ?? body.amount_cents ?? null;

    if (!transactionHash) {
      console.warn("Webhook InvictusPay sem transaction_hash, ignorando.");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabase) {
      console.error("Supabase client não inicializado.");
    } else {
      const newStatus = status === "paid" ? "paid" : status === "failed" ? "failed" : "pending";

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, amount_cents: amount ?? undefined })
        .eq("external_id", transactionHash);

      if (error) {
        console.error("Erro ao atualizar pedido no banco:", error);
      }

      if (newStatus === "paid") {
        console.log("Pagamento PIX confirmado para:", transactionHash);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook InvictusPay:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar webhook" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
