import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const baseUrl = "https://api.invictuspay.com.br/api/public/v1";

const invictusApiToken = Deno.env.get("INVICTUSPAY_API_TOKEN");
const invictusOfferHash = Deno.env.get("INVICTUSPAY_OFFER_HASH");
const invictusProductHash = Deno.env.get("INVICTUSPAY_PRODUCT_HASH");

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!invictusApiToken) {
  console.error("INVICTUSPAY_API_TOKEN não configurado nas variáveis de ambiente.");
}

if (!invictusOfferHash) {
  console.error("INVICTUSPAY_OFFER_HASH não configurado nas variáveis de ambiente.");
}

if (!invictusProductHash) {
  console.error("INVICTUSPAY_PRODUCT_HASH não configurado nas variáveis de ambiente.");
}

if (!supabaseUrl) {
  console.error("SUPABASE_URL não configurado nas variáveis de ambiente.");
}

if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY não configurado nas variáveis de ambiente.");
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

  if (!invictusApiToken || !invictusOfferHash || !invictusProductHash) {
    return new Response(JSON.stringify({ error: "Configuração de pagamento indisponível" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { name, email, document, amount, type } = await req.json();

    if (!name || !email || !document) {
      return new Response(
        JSON.stringify({ error: "Nome, e-mail e CPF são obrigatórios." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof document !== "string" || document.replace(/\D/g, "").length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF deve conter 11 números." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amountInCents = Number.isInteger(amount) && amount > 0 ? amount : 15000;
    const cleanCpf = document.replace(/\D/g, "");

    const payload = {
      amount: amountInCents,
      offer_hash: invictusOfferHash,
      payment_method: "pix",
      customer: {
        name,
        email,
        phone_number: "11999999999",
        document: cleanCpf,
      },
      cart: [
        {
          product_hash: invictusProductHash,
          title: type === "whatsapp" ? "Grupo VIP" : "Assinatura",
          price: amountInCents,
          quantity: 1,
          operation_type: 1,
          tangible: false,
        },
      ],
    };

    const invictusResponse = await fetch(
      `${baseUrl}/transactions?api_token=${encodeURIComponent(invictusApiToken)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await invictusResponse.json();

    if (!invictusResponse.ok) {
      console.error("Erro InvictusPay:", data);
      return new Response(
        JSON.stringify({
          error: "Não foi possível gerar o pagamento PIX. Tente novamente em alguns minutos.",
          provider_status: invictusResponse.status,
          provider_response: data,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const transactionHash = data.transaction_hash ?? data.hash ?? null;
    const qrCode = data.qr_code ?? data.pix_qr_code ?? null;
    const pixCode = data.pix_code ?? data.copy_paste ?? null;
    const status = data.status ?? "pending";

    let orderId: string | null = null;

    if (supabase && transactionHash) {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          external_id: transactionHash,
          type: type || "subscription",
          amount_cents: amountInCents,
          status,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Erro ao salvar pedido no banco:", orderError);
      } else {
        orderId = order?.id ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        transaction_hash: transactionHash,
        qr_code: qrCode,
        pix_code: pixCode,
        status,
        orderId,
        provider_response: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Erro inesperado ao criar PIX InvictusPay:", error);
    return new Response(JSON.stringify({ error: "Erro inesperado ao criar PIX." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
