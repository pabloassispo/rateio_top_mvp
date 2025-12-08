import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import * as db from "./db";
import { pagarmeService } from "./pagarme";
import { ENV } from "./_core/env";

const webhookRouter = Router();

interface RawBodyRequest extends Request {
  rawBody?: string;
}

/**
 * Webhook endpoint for Pagar.me payment notifications
 * POST /webhook/pagarme
 * 
 * Expected payload:
 * {
 *   "id": "evt_xxxxx",
 *   "type": "charge.paid" | "charge.refunded" | "charge.failed",
 *   "data": {
 *     "id": "ch_xxxxx",
 *     "status": "paid" | "refunded" | "failed",
 *     "amount": 10000,
 *     ...
 *   }
 * }
 */
webhookRouter.post("/pagarme", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as RawBodyRequest).rawBody ?? JSON.stringify(req.body ?? {});
    const signature =
      req.header("x-hub-signature") ??
      req.header("x-hub-signature-256") ??
      req.header("x-hub-signature-sha256");

    if (!pagarmeService.validateWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const { type, data } = req.body;

    console.log(`[Webhook] Received event: ${type}`, data);

    if (!type || !data) {
      return res.status(400).json({ error: "Missing type or data" });
    }

    const chargeId = data.id;
    if (!chargeId) {
      return res.status(400).json({ error: "Missing charge ID" });
    }

    // Find the payment intent by pagarmeIntentId
    const intent = await db.getPaymentIntentByChargeId(chargeId);
    if (!intent) {
      console.warn(`[Webhook] No intent found for charge ${chargeId}`);
      return res.status(404).json({ error: "Intent not found" });
    }

    const participant = await db.getParticipantById(intent.participantId);
    if (!participant) {
      console.warn(`[Webhook] No participant found for intent ${intent.participantId}`);
      return res.status(404).json({ error: "Participant not found" });
    }

    const rateio = await db.getRateioById(participant.rateioId);
    if (!rateio) {
      console.warn(`[Webhook] No rateio found for participant ${participant.id}`);
      return res.status(404).json({ error: "Rateio not found" });
    }

    // Handle different event types
    switch (type) {
      case "charge.paid":
        await handleChargePaid(intent, participant, rateio, data);
        break;

      case "charge.refunded":
        await handleChargeRefunded(intent, participant, rateio, data);
        break;

      case "charge.failed":
        await handleChargeFailed(intent, participant, rateio, data);
        break;

      default:
        console.warn(`[Webhook] Unknown event type: ${type}`);
        return res.status(400).json({ error: "Unknown event type" });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function handleChargePaid(intent: any, participant: any, rateio: any, data: any) {
  console.log(`[Webhook] Processing charge.paid for participant ${participant.id}`);

  // Update participant status
  await db.updateParticipantStatus(participant.id, "PAGO", data.amount);

  // Create transaction record
  await db.createTransaction({
    id: uuidv4(),
    participantId: participant.id,
    rateioId: rateio.id,
    pagarmeTransactionId: data.id,
    amount: data.amount,
  });

  // Update transaction status
  const txs = await db.getTransactionsByRateio(rateio.id);
  const lastTx = txs[txs.length - 1];
  if (lastTx) {
    await db.updateTransactionStatus(lastTx.id, "PAGO", new Date());
  }

  // Create event
  await db.createRateioEvent({
    id: uuidv4(),
    rateioId: rateio.id,
    participantId: participant.id,
    eventType: "PAGAMENTO_CONFIRMADO",
    message: `Pagamento de R$ ${(data.amount / 100).toFixed(2)} confirmado`,
  });

  // Check if rateio is complete
  const progress = await db.calculateRateioProgress(rateio.id);
  if (progress && progress.isPaid) {
    console.log(`[Webhook] Rateio ${rateio.id} reached 100%`);
    await db.updateRateioStatus(rateio.id, "CONCLUIDO");
    await db.createRateioEvent({
      id: uuidv4(),
      rateioId: rateio.id,
      eventType: "CONCLUIDO",
      message: "Rateio concluído! Liquidação automática iniciada.",
    });

    // TODO: Process automatic refunds if needed
    // TODO: Send notifications to participants
  }
}

async function handleChargeRefunded(intent: any, participant: any, rateio: any, data: any) {
  console.log(`[Webhook] Processing charge.refunded for participant ${participant.id}`);

  // Update participant status
  await db.updateParticipantStatus(participant.id, "REEMBOLSADO");

  // Update transaction status
  const txs = await db.getTransactionsByRateio(rateio.id);
  const participantTx = txs.find(tx => tx.participantId === participant.id);
  if (participantTx) {
    await db.updateTransactionStatus(participantTx.id, "REEMBOLSADO", new Date());
  }

  // Create event
  await db.createRateioEvent({
    id: uuidv4(),
    rateioId: rateio.id,
    participantId: participant.id,
    eventType: "REEMBOLSO_SOLICITADO",
    message: `Reembolso de R$ ${(data.amount / 100).toFixed(2)} processado`,
  });
}

async function handleChargeFailed(intent: any, participant: any, rateio: any, data: any) {
  console.log(`[Webhook] Processing charge.failed for participant ${participant.id}`);

  // Update transaction status
  const txs = await db.getTransactionsByRateio(rateio.id);
  const participantTx = txs.find(tx => tx.participantId === participant.id);
  if (participantTx) {
    await db.updateTransactionStatus(participantTx.id, "FALHOU");
  }

  // Create event
  await db.createRateioEvent({
    id: uuidv4(),
    rateioId: rateio.id,
    participantId: participant.id,
    eventType: "PAGAMENTO_CONFIRMADO", // Still log as attempt
    message: `Pagamento falhou. Tente novamente.`,
  });
}

/**
 * Helper endpoint to find charge ID from participant ID
 * GET /webhook/pagarme/find-charge/:participantId
 */
webhookRouter.get("/pagarme/find-charge/:participantId", async (req: Request, res: Response) => {
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
      chargeId: intent.pagarmeIntentId,
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
 * Test endpoint to simulate payment webhook (development only)
 * POST /webhook/pagarme/test
 * 
 * This endpoint bypasses signature validation and allows simulating payments
 * for testing purposes.
 * 
 * Payload options:
 * 1. Using chargeId (preferred):
 *    { "chargeId": "ch_xxxxx", "amount": 300, "type": "charge.paid" }
 * 
 * 2. Using participantId (will find charge ID automatically):
 *    { "participantId": "uuid-here", "amount": 300, "type": "charge.paid" }
 * 
 * 3. Using transactionId (will search Pagar.me API):
 *    { "transactionId": "tran_xxxxx", "amount": 300, "type": "charge.paid" }
 */
webhookRouter.post("/pagarme/test", async (req: Request, res: Response) => {
  try {
    const { chargeId, transactionId, participantId, amount, type = "charge.paid" } = req.body;

    let finalChargeId = chargeId;

    // If participantId is provided, find the charge ID from payment intent
    if (!finalChargeId && participantId) {
      try {
        console.log(`[Webhook Test] Participant ID provided: ${participantId}, searching for charge...`);
        const intent = await db.getPaymentIntentByParticipant(participantId);
        if (intent) {
          finalChargeId = intent.pagarmeIntentId;
          console.log(`[Webhook Test] Found charge ID from participant: ${finalChargeId}`);
        } else {
          return res.status(404).json({ 
            error: "No payment intent found for this participant",
            hint: "Make sure the participant has created a payment intent first"
          });
        }
      } catch (error: any) {
        console.error(`[Webhook Test] Error finding charge from participant:`, error);
        return res.status(400).json({ 
          error: `Failed to find charge from participant: ${error.message}`
        });
      }
    }

    // If transactionId is provided but chargeId is not, try to find charge ID by searching charges
    if (!finalChargeId && transactionId) {
      try {
        console.log(`[Webhook Test] Transaction ID provided: ${transactionId}, searching for charge...`);
        
        // Search for charge that contains this transaction
        // We'll search recent charges (last 50) to find the one with this transaction
        const authHeader = `Basic ${Buffer.from(`${ENV.pagarmeApiKey}:`).toString("base64")}`;
        
        const chargesResponse = await axios.get("https://api.pagar.me/core/v5/charges", {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          params: { size: 50, page: 1 }
        });
        
        const charge = chargesResponse.data.data?.find((ch: any) => 
          ch.last_transaction?.id === transactionId
        );
        
        if (charge) {
          finalChargeId = charge.id;
          console.log(`[Webhook Test] Found charge ID: ${finalChargeId}`);
        } else {
          return res.status(400).json({ 
            error: "Could not find charge ID from transaction. Please provide chargeId directly.",
            hint: "The charge ID starts with 'ch_' and is returned when creating the payment intent. You can also find it in the Pagar.me dashboard."
          });
        }
      } catch (error: any) {
        console.error(`[Webhook Test] Error searching for charge:`, error);
        return res.status(400).json({ 
          error: `Failed to find charge from transaction: ${error.message}`,
          hint: "Please provide chargeId directly (starts with 'ch_'). You can find it in the Pagar.me dashboard or in the payment intent response."
        });
      }
    }

    if (!finalChargeId) {
      return res.status(400).json({ error: "Missing chargeId or transactionId" });
    }

    console.log(`[Webhook Test] Simulating ${type} for charge ${finalChargeId}`);

    // Find the payment intent by pagarmeIntentId
    const intent = await db.getPaymentIntentByChargeId(finalChargeId);
    if (!intent) {
      console.warn(`[Webhook Test] No intent found for charge ${finalChargeId}`);
      return res.status(404).json({ 
        error: "Intent not found. Make sure the charge ID is correct.",
        hint: "The charge ID should be the 'id' field returned when creating the payment intent (starts with 'ch_')"
      });
    }

    const participant = await db.getParticipantById(intent.participantId);
    if (!participant) {
      console.warn(`[Webhook Test] No participant found for intent ${intent.participantId}`);
      return res.status(404).json({ error: "Participant not found" });
    }

    const rateio = await db.getRateioById(participant.rateioId);
    if (!rateio) {
      console.warn(`[Webhook Test] No rateio found for participant ${participant.id}`);
      return res.status(404).json({ error: "Rateio not found" });
    }

    // Use provided amount or get from charge
    const finalAmount = amount || rateio.totalAmount;

    // Simulate webhook data
    const webhookData = {
      id: finalChargeId,
      status: type === "charge.paid" ? "paid" : type === "charge.refunded" ? "refunded" : "failed",
      amount: finalAmount,
    };

    // Handle different event types
    switch (type) {
      case "charge.paid":
        await handleChargePaid(intent, participant, rateio, webhookData);
        break;

      case "charge.refunded":
        await handleChargeRefunded(intent, participant, rateio, webhookData);
        break;

      case "charge.failed":
        await handleChargeFailed(intent, participant, rateio, webhookData);
        break;

      default:
        return res.status(400).json({ error: "Unknown event type. Use: charge.paid, charge.refunded, or charge.failed" });
    }

    res.status(200).json({ 
      success: true,
      message: `Successfully simulated ${type} for charge ${chargeId}`,
      participantId: participant.id,
      rateioId: rateio.id,
      amount: finalAmount,
    });
  } catch (error: any) {
    console.error("[Webhook Test] Error simulating webhook:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default webhookRouter;
