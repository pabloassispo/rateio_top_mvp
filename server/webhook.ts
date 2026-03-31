import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as db from "./db";
import { efiPayService } from "./efipay";

const webhookRouter = Router();

interface RawBodyRequest extends Request {
  rawBody?: string;
}

/**
 * Webhook endpoint for Efí Pay Pix notifications
 * POST /webhook/efipay
 * 
 * Efí Pay uses mTLS for authentication, so the webhook endpoint should only
 * accept connections with valid certificates.
 * 
 * Expected payload structure (Pix received):
 * {
 *   "pix": [
 *     {
 *       "endToEndId": "E00000000202401011234abcdefghij",
 *       "txid": "abc123def456...",
 *       "valor": "100.00",
 *       "horario": "2024-01-01T12:00:00.000Z",
 *       "chave": "recipient-pix-key",
 *       "infoPagador": "Rateio: Nome do Rateio"
 *     }
 *   ]
 * }
 */
webhookRouter.post("/efipay", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as RawBodyRequest).rawBody ?? JSON.stringify(req.body ?? {});

    console.log("[Webhook] Received request");
    console.log("[Webhook] Headers:", {
      "content-type": req.headers["content-type"],
      "x-client-verify": req.headers["x-client-verify"],
      "user-agent": req.headers["user-agent"],
    });
    console.log("[Webhook] Raw body:", rawBody.substring(0, 500));

    const body = req.body ?? {};
    const { pix } = body;

    // Efí sends a validation request during webhook setup with an empty or
    // minimal body. We must return 200 to confirm the endpoint is reachable.
    if (!pix) {
      console.log("[Webhook] Validation/ping request received (no pix payload) — responding 200");
      return res.status(200).json({ success: true });
    }

    if (!Array.isArray(pix) || pix.length === 0) {
      console.warn("[Webhook] pix field present but empty or not an array");
      return res.status(200).json({ success: true, ignored: true });
    }

    console.log(`[Webhook] Processing ${pix.length} Pix transaction(s):`, JSON.stringify(pix).substring(0, 300));

    // Process each Pix transaction
    for (const pixTx of pix) {
      const { txid, endToEndId, valor, horario, chave, infoPagador } = pixTx;

      console.log(`[Webhook] Processing Pix:`, {
        txid,
        endToEndId: endToEndId?.substring(0, 20) + "...",
        valor,
      });

      if (!txid) {
        console.warn("[Webhook] Pix transaction missing txid");
        continue;
      }

      // Find the payment intent by txid (stored as pagarmeIntentId for backward compatibility)
      const intent = await db.getPaymentIntentByChargeId(txid);
      if (!intent) {
        console.warn(`[Webhook] No intent found for txid ${txid}`);
        continue;
      }

      const participant = await db.getParticipantById(intent.participantId);
      if (!participant) {
        console.warn(`[Webhook] No participant found for intent ${intent.participantId}`);
        continue;
      }

      const rateio = await db.getRateioById(participant.rateioId);
      if (!rateio) {
        console.warn(`[Webhook] No rateio found for participant ${participant.id}`);
        continue;
      }

      // Convert valor from string to cents (e.g., "100.00" -> 10000)
      const amountInCents = Math.round(parseFloat(valor) * 100);

      // Handle the payment confirmation
      await handlePixReceived(intent, participant, rateio, {
        txid,
        endToEndId,
        amount: amountInCents,
        horario,
        infoPagador,
      });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Legacy webhook endpoint for Pagar.me (backward compatibility)
 * POST /webhook/pagarme
 */
webhookRouter.post("/pagarme", async (req: Request, res: Response) => {
  console.warn("[Webhook] Received Pagar.me webhook - this endpoint is deprecated");
  console.log("[Webhook] Payload:", JSON.stringify(req.body, null, 2));
  
  // Return success to avoid retries, but log a warning
  res.status(200).json({ 
    success: true, 
    warning: "Pagar.me webhooks are deprecated. Please migrate to Efí Pay." 
  });
});

/**
 * Handle a received Pix payment
 */
async function handlePixReceived(
  intent: any,
  participant: any,
  rateio: any,
  pixData: {
    txid: string;
    endToEndId: string;
    amount: number;
    horario: string;
    infoPagador?: string;
  }
) {
  console.log(`[Webhook] Processing Pix received for participant ${participant.id}`);

  // Update participant status
  await db.updateParticipantStatus(participant.id, "PAGO", pixData.amount);

  // Update payment intent status
  await db.updatePaymentIntentStatus(intent.id, "PAGO");

  // Create transaction record with endToEndId (needed for refunds)
  await db.createTransaction({
    id: uuidv4(),
    participantId: participant.id,
    rateioId: rateio.id,
    pagarmeTransactionId: pixData.endToEndId, // Store e2eId for refunds
    amount: pixData.amount,
  });

  // Update transaction status
  const txs = await db.getTransactionsByRateio(rateio.id);
  const lastTx = txs[txs.length - 1];
  if (lastTx) {
    await db.updateTransactionStatus(lastTx.id, "PAGO", new Date(pixData.horario));
  }

  // Create event
  await db.createRateioEvent({
    id: uuidv4(),
    rateioId: rateio.id,
    participantId: participant.id,
    eventType: "PAGAMENTO_CONFIRMADO",
    message: `Pagamento de R$ ${(pixData.amount / 100).toFixed(2)} confirmado`,
  });

  // Check if rateio is complete
  const progress = await db.calculateRateioProgress(rateio.id);
  if (progress && progress.isPaid) {
    console.log(`[Webhook] Rateio ${rateio.id} reached 100%`);
    
    // Create completion event (but don't automatically transfer yet)
    await db.createRateioEvent({
      id: uuidv4(),
      rateioId: rateio.id,
      eventType: "CONCLUIDO",
      message: "Meta atingida! O criador pode solicitar a transferência.",
    });

    // TODO: Optionally trigger automatic transfer to creator
    // await autoTransferToCreator(rateio);
  }
}

/**
 * Helper endpoint to find txid from participant ID
 * GET /webhook/efipay/find-charge/:participantId
 */
webhookRouter.get("/efipay/find-charge/:participantId", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    
    const intent = await db.getPaymentIntentByParticipant(participantId);
    if (!intent) {
      return res.status(404).json({ error: "No payment intent found for this participant" });
    }

    const participant = await db.getParticipantById(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    res.status(200).json({
      participantId,
      txid: intent.pagarmeIntentId, // This now stores the Efí txid
      participantStatus: participant.status,
      paidAmount: participant.paidAmount,
      intentStatus: intent.status,
      createdAt: intent.createdAt,
    });
  } catch (error: any) {
    console.error("[Webhook] Error finding charge:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * Test endpoint to simulate Efí payment webhook (development only)
 * POST /webhook/efipay/test
 * 
 * This endpoint bypasses mTLS validation and allows simulating payments
 * for testing purposes.
 * 
 * Payload:
 * { "participantId": "uuid-here" } // RECOMMENDED: uses participant's contribution amount automatically
 * or
 * { "participantId": "uuid-here", "amount": 1000 } // amount in CENTS (1000 = R$ 10.00)
 * or
 * { "txid": "abc123..." } // Uses rateio's total amount
 * 
 * NOTE: If "amount" is NOT provided, the system automatically uses:
 * 1. Payment intent's charge amount (most accurate - stored when QR Code was generated)
 * 2. Rateio's total amount (fallback)
 */
webhookRouter.post("/efipay/test", async (req: Request, res: Response) => {
  try {
    const { txid, participantId, amount } = req.body;

    let finalTxid = txid;

    // If participantId is provided, find the txid from payment intent
    if (!finalTxid && participantId) {
      const intent = await db.getPaymentIntentByParticipant(participantId);
      if (intent) {
        finalTxid = intent.pagarmeIntentId;
        console.log(`[Webhook Test] Found txid from participant: ${finalTxid}`);
      } else {
        return res.status(404).json({ 
          error: "No payment intent found for this participant",
          hint: "Make sure the participant has created a payment intent first"
        });
      }
    }

    if (!finalTxid) {
      return res.status(400).json({ error: "Missing txid or participantId" });
    }

    console.log(`[Webhook Test] Simulating Pix payment for txid ${finalTxid}`);

    // Find the payment intent
    const intent = await db.getPaymentIntentByChargeId(finalTxid);
    if (!intent) {
      return res.status(404).json({ 
        error: "Intent not found. Make sure the txid is correct.",
        hint: "The txid is returned when creating the payment intent"
      });
    }

    const participant = await db.getParticipantById(intent.participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const rateio = await db.getRateioById(participant.rateioId);
    if (!rateio) {
      return res.status(404).json({ error: "Rateio not found" });
    }

    // Determine the correct amount to use:
    // 1. If amount is provided in the request, use it (must be in cents)
    // 2. Otherwise, get from the payment intent (the actual charge amount)
    // 3. Finally, fallback to rateio's totalAmount
    let finalAmount: number;
    
    if (amount) {
      // Amount explicitly provided (in cents)
      finalAmount = amount;
      console.log(`[Webhook Test] Using provided amount: R$ ${(finalAmount / 100).toFixed(2)}`);
    } else if (intent.amount && intent.amount > 0) {
      // Use payment intent's charge amount (most accurate)
      finalAmount = intent.amount;
      console.log(`[Webhook Test] Using payment intent amount: R$ ${(finalAmount / 100).toFixed(2)}`);
    } else {
      // Fallback to rateio's total amount
      finalAmount = rateio.totalAmount;
      console.log(`[Webhook Test] Using rateio's total amount: R$ ${(finalAmount / 100).toFixed(2)}`);
    }

    // Generate a fake e2eId for testing
    const fakeE2eId = `E${Date.now()}${Math.random().toString(36).substring(2, 15)}`;

    // Process the payment
    await handlePixReceived(intent, participant, rateio, {
      txid: finalTxid,
      endToEndId: fakeE2eId,
      amount: finalAmount,
      horario: new Date().toISOString(),
      infoPagador: `Rateio: ${rateio.name}`,
    });

    res.status(200).json({ 
      success: true,
      message: `Successfully simulated Pix payment for txid ${finalTxid}`,
      participantId: participant.id,
      rateioId: rateio.id,
      amount: finalAmount,
      e2eId: fakeE2eId,
    });
  } catch (error: any) {
    console.error("[Webhook Test] Error simulating webhook:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

/**
 * Test endpoint to pay a QR Code via API (simulates homologation environment)
 * POST /webhook/efipay/pay-qrcode
 * 
 * Body:
 * {
 *   "participantId": "uuid-here",
 *   "payerPixKey": "[email protected]" // Optional, defaults to test key
 * }
 */
webhookRouter.post("/efipay/pay-qrcode", async (req: Request, res: Response) => {
  try {
    const { participantId, payerPixKey = "[email protected]" } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId" });
    }

    // Find the payment intent
    const intent = await db.getPaymentIntentByParticipant(participantId);
    if (!intent) {
      return res.status(404).json({ 
        error: "No payment intent found for this participant",
        hint: "Make sure the participant has created a payment intent first"
      });
    }

    const participant = await db.getParticipantById(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const rateio = await db.getRateioById(participant.rateioId);
    if (!rateio) {
      return res.status(404).json({ error: "Rateio not found" });
    }

    // Get the QR Code from the payment intent
    if (!intent.copyPaste) {
      return res.status(400).json({ 
        error: "No QR Code found for this payment intent",
        hint: "The QR Code (pixCopiaECola) is missing"
      });
    }

    console.log(`[Webhook Test] Paying QR Code for participant ${participantId} using API`);

    // Pay the QR Code via Efí API
    const paymentResponse = await efiPayService.payPixQRCode(
      intent.copyPaste,
      payerPixKey,
      `Rateio: ${rateio.name}`
    );

    console.log(`[Webhook Test] ✅ Payment sent via API:`, paymentResponse.e2eId);

    // The actual payment confirmation will arrive via webhook
    // For testing, we can simulate it immediately
    if (paymentResponse.status === "EM_PROCESSAMENTO") {
      // Simulate webhook arrival after a short delay
      setTimeout(async () => {
        await handlePixReceived(intent, participant, rateio, {
          txid: intent.pagarmeIntentId,
          endToEndId: paymentResponse.e2eId,
          amount: rateio.totalAmount,
          horario: new Date().toISOString(),
          infoPagador: `Rateio: ${rateio.name}`,
        });
        console.log(`[Webhook Test] ✅ Simulated webhook received for e2eId ${paymentResponse.e2eId}`);
      }, 2000); // 2 second delay to simulate real webhook
    }

    res.status(200).json({ 
      success: true,
      message: "QR Code payment sent successfully. Webhook will arrive shortly.",
      payment: paymentResponse,
      participantId: participant.id,
      rateioId: rateio.id,
      hint: "In production, the webhook will notify you when the payment is confirmed"
    });
  } catch (error: any) {
    console.error("[Webhook Test] Error paying QR Code:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error.message,
      hint: "Make sure EFI_PIX_KEY has a webhook configured and the pix.send scope is enabled"
    });
  }
});

// Legacy endpoints for backward compatibility
webhookRouter.get("/pagarme/find-charge/:participantId", async (req: Request, res: Response) => {
  // Redirect to new endpoint
  res.redirect(`/api/webhook/efipay/find-charge/${req.params.participantId}`);
});

webhookRouter.post("/pagarme/test", async (req: Request, res: Response) => {
  console.warn("[Webhook] Using deprecated /pagarme/test endpoint. Please use /efipay/test");
  // Forward to new endpoint
  req.url = "/efipay/test";
  webhookRouter.handle(req, res, () => {});
});

export default webhookRouter;
