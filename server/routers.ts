import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { pagarmeService } from "./pagarme";

// ============= VALIDATORS =============

const pixKeyTypeMap: Record<string, "EVP" | "CPF" | "CNPJ" | "EMAIL" | "TELEFONE"> = {
  EVP: "EVP",
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "EMAIL",
  TELEFONE: "TELEFONE",
};

function detectPixKeyType(key: string): "EVP" | "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | null {
  // EVP: UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return "EVP";
  }
  // CPF: 11 digits
  if (/^\d{11}$/.test(key)) {
    return "CPF";
  }
  // CNPJ: 14 digits
  if (/^\d{14}$/.test(key)) {
    return "CNPJ";
  }
  // EMAIL
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return "EMAIL";
  }
  // TELEFONE: 10-11 digits
  if (/^\d{10,11}$/.test(key)) {
    return "TELEFONE";
  }
  return null;
}

function validatePixKey(key: string, type: string): boolean {
  switch (type) {
    case "EVP":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    case "CPF":
      return /^\d{11}$/.test(key);
    case "CNPJ":
      return /^\d{14}$/.test(key);
    case "EMAIL":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case "TELEFONE":
      return /^\d{10,11}$/.test(key);
    default:
      return false;
  }
}

// ============= RATEIO ROUTER =============

const rateioRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(60),
        description: z.string().max(140).optional(),
        imageUrl: z.string().url().optional(),
        totalAmount: z.number().int().min(1), // in cents
        targetAmount: z.number().int().min(1).optional(),
        privacyMode: z.enum(["TOTAL", "PARCIAL", "ABERTO"]).default("PARCIAL"),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rateioId = uuidv4();
      
      await db.createRateio({
        id: rateioId,
        creatorId: ctx.user.id,
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        totalAmount: input.totalAmount,
        targetAmount: input.targetAmount,
        privacyMode: input.privacyMode,
        expiresAt: input.expiresAt,
      });

      await db.createRateioEvent({
        id: uuidv4(),
        rateioId,
        eventType: "CRIADO",
        message: `Rateio "${input.name}" criado`,
      });

      return { id: rateioId, slug: `familyos.link/${rateioId}` };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rateio = await db.getRateioById(input.id);
      if (!rateio) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rateio not found" });
      }

      const progress = await db.calculateRateioProgress(input.id);
      const participantList = await db.getParticipantsByRateio(input.id);
      const events = await db.getRateioEventsByRateio(input.id);

      return {
        ...rateio,
        progress,
        participantCount: participantList.length,
        events,
      };
    }),

  getByCreator: protectedProcedure.query(async ({ ctx }) => {
    return await db.getRateiosByCreator(ctx.user.id);
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["ATIVO", "CONCLUIDO", "CANCELADO"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rateio = await db.getRateioById(input.id);
      if (!rateio) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (rateio.creatorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateRateioStatus(input.id, input.status);

      const eventType = input.status === "CONCLUIDO" ? "CONCLUIDO" : "CANCELADO";
      await db.createRateioEvent({
        id: uuidv4(),
        rateioId: input.id,
        eventType,
        message: `Rateio ${eventType.toLowerCase()}`,
      });

      return { success: true };
    }),
});

// ============= PARTICIPANT ROUTER =============

const participantRouter = router({
  create: publicProcedure
    .input(
      z.object({
        rateioId: z.string().uuid(),
        pixKey: z.string(),
        autoRefund: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const rateio = await db.getRateioById(input.rateioId);
      if (!rateio) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rateio not found" });
      }

      const pixKeyType = detectPixKeyType(input.pixKey);
      if (!pixKeyType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chave Pix inválida",
        });
      }

      if (!validatePixKey(input.pixKey, pixKeyType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Chave Pix inválida para tipo ${pixKeyType}`,
        });
      }

      const participantId = uuidv4();
      await db.createParticipant({
        id: participantId,
        rateioId: input.rateioId,
        pixKey: input.pixKey,
        pixKeyType,
        autoRefund: input.autoRefund,
      });

      await db.createRateioEvent({
        id: uuidv4(),
        rateioId: input.rateioId,
        participantId,
        eventType: "PARTICIPANTE_ADICIONADO",
        message: "Novo participante adicionado",
      });

      return { id: participantId };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db.getParticipantById(input.id);
    }),

  getByRateio: publicProcedure
    .input(z.object({ rateioId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db.getParticipantsByRateio(input.rateioId);
    }),
});

// ============= PAYMENT INTENT ROUTER =============

const paymentRouter = router({
  createIntent: publicProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
      })
    )
    .mutation(async ({ input }) => {
      const participant = await db.getParticipantById(input.participantId);
      if (!participant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const rateio = await db.getRateioById(participant.rateioId);
      if (!rateio) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      try {
        // Create Pix charge via Pagar.me
        const charge = await pagarmeService.createPixCharge(
          rateio.totalAmount,
          `Rateio: ${rateio.name}`
        );

        const paymentIntentId = uuidv4();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await db.createPaymentIntent({
          id: paymentIntentId,
          participantId: input.participantId,
          pagarmeIntentId: charge.id,
          qrCode: charge.pix_qr_code,
          copyPaste: charge.pix_copy_and_paste,
          expiresAt,
        });

        return {
          id: paymentIntentId,
          qrCode: charge.pix_qr_code,
          copyPaste: charge.pix_copy_and_paste,
          expiresAt,
        };
      } catch (error: any) {
        console.error("[Payment] Error creating intent:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Falha ao gerar QR Code Pix. Tente novamente.",
        });
      }
    }),

  getStatus: publicProcedure
    .input(z.object({ participantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const intent = await db.getPaymentIntentByParticipant(input.participantId);
      if (!intent) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const participant = await db.getParticipantById(input.participantId);
      if (!participant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      try {
        // Check status with Pagar.me
        const charge = await pagarmeService.getChargeStatus(intent.pagarmeIntentId);

        return {
          status: participant.status,
          paidAmount: participant.paidAmount,
          intentStatus: intent.status,
          chargeStatus: charge.status,
          expiresAt: intent.expiresAt,
        };
      } catch (error: any) {
        console.error("[Payment] Error getting status:", error);
        return {
          status: participant.status,
          paidAmount: participant.paidAmount,
          intentStatus: intent.status,
          expiresAt: intent.expiresAt,
          error: "Falha ao obter status do pagamento",
        };
      }
    }),

  refund: protectedProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        amount: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const participant = await db.getParticipantById(input.participantId);
      if (!participant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const intent = await db.getPaymentIntentByParticipant(input.participantId);
      if (!intent) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No payment intent found" });
      }

      try {
        const refund = await pagarmeService.refundCharge(
          intent.pagarmeIntentId,
          input.amount
        );

        await db.updateParticipantStatus(input.participantId, "REEMBOLSADO");

        return { success: true, refundId: refund.id };
      } catch (error: any) {
        console.error("[Payment] Error refunding:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Falha ao processar reembolso",
        });
      }
    }),
});

// ============= MAIN ROUTER =============

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  rateio: rateioRouter,
  participant: participantRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
