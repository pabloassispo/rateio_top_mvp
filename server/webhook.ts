import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as db from "./db";

const webhookRouter = Router();

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
    const { type, data } = req.body;

    console.log(`[Webhook] Received event: ${type}`, data);

    // Validate webhook signature (TODO: implement proper validation)
    // const signature = req.headers["x-hub-signature"];
    // if (!validateSignature(req.body, signature)) {
    //   return res.status(401).json({ error: "Invalid signature" });
    // }

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



export default webhookRouter;
