import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { pagarmeService } from "./pagarme";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";

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
        // Ensure numeric values are numbers, not strings
        totalAmount: Number(rateio.totalAmount),
        targetAmount: rateio.targetAmount ? Number(rateio.targetAmount) : null,
        progress: progress ? {
          paidAmount: Number(progress.paidAmount),
          targetAmount: Number(progress.targetAmount),
          progress: Number(progress.progress),
          isPaid: Boolean(progress.isPaid),
        } : null,
        participantCount: participantList.length,
        events,
      };
    }),

  getByCreator: protectedProcedure.query(async ({ ctx }) => {
    const rateios = await db.getRateiosByCreator(ctx.user.id);
    
    // Enhance each rateio with progress information
    const rateiossWithProgress = await Promise.all(
      rateios.map(async (rateio) => {
        const progress = await db.calculateRateioProgress(rateio.id);
        const participantList = await db.getParticipantsByRateio(rateio.id);
        
        return {
          ...rateio,
          // Ensure numeric values are numbers, not strings
          totalAmount: Number(rateio.totalAmount),
          targetAmount: rateio.targetAmount ? Number(rateio.targetAmount) : null,
          progress: progress ? {
            paidAmount: Number(progress.paidAmount),
            targetAmount: Number(progress.targetAmount),
            progress: Number(progress.progress),
            isPaid: Boolean(progress.isPaid),
          } : null,
          participantCount: participantList.length,
        };
      })
    );
    
    return rateiossWithProgress;
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
    .mutation(async ({ ctx, input }) => {
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
        userId: ctx.user?.id, // Save userId if user is authenticated
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
      const participants = await db.getParticipantsByRateio(input.rateioId);
      // Return participants with user info and ensure numeric values
      return participants.map(p => ({
        ...p,
        paidAmount: Number(p.paidAmount || 0),
        user: p.user ? {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
        } : null,
      }));
    }),
});

// ============= PAYMENT INTENT ROUTER =============

const paymentRouter = router({
  createIntent: publicProcedure
    .input(
      z.object({
        participantId: z.string().uuid(),
        amount: z.number().int().positive().optional(), // Amount in cents, optional
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

      // Use provided amount or default to totalAmount
      const chargeAmount = input.amount || rateio.totalAmount;

      // Validate that amount doesn't exceed totalAmount
      if (chargeAmount > rateio.totalAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `O valor da contribuição não pode ser maior que R$ ${(rateio.totalAmount / 100).toFixed(2)}`,
        });
      }

      try {
        // Create Pix charge via Pagar.me
        // Pagar.me requires customer data - get from user if participant has userId
        let customerData: {
          name: string;
          email: string;
          document?: string;
          document_type?: string;
          phones?: {
            mobile_phone?: {
              country_code: string;
              area_code: string;
              number: string;
            };
          };
        } = {
          name: "Participante Rateio",
          email: "participante@rateio.top",
        };

        // If participant has userId, get user data
        if (participant.userId) {
          const user = await db.getUserById(participant.userId);
          if (user) {
            customerData.name = user.name || customerData.name;
            customerData.email = user.email || customerData.email;
            
            // Use CPF if available
            if (user.cpf) {
              customerData.document = user.cpf;
              customerData.document_type = "CPF";
            }
            
            // Format phone number for Pagar.me (contato format: 10 or 11 digits, e.g., "11987654321")
            if (user.contato && (user.contato.length === 10 || user.contato.length === 11)) {
              const phone = user.contato;
              // Extract area code (first 2 digits) and number (rest)
              const areaCode = phone.substring(0, 2);
              const number = phone.substring(2);
              
              customerData.phones = {
                mobile_phone: {
                  country_code: "55", // Brazil
                  area_code: areaCode,
                  number: number,
                },
              };
            }
          }
        }
        
        // Fallback: use participant's PIX key as email if it's an EMAIL type
        if (participant.pixKeyType === "EMAIL" && !customerData.email.includes("@")) {
          customerData.email = participant.pixKey;
        }
        
        const charge = await pagarmeService.createPixCharge(
          chargeAmount,
          `Rateio: ${rateio.name}`,
          customerData
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
      // Clear cookie with same options used to set it
      ctx.res.clearCookie(COOKIE_NAME, { 
        ...cookieOptions, 
        maxAge: 0,
        expires: new Date(0),
      });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
          name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user already exists
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email já está em uso",
          });
        }

        // Generate openId (using email as base for uniqueness)
        const openId = `email:${input.email}`;
        
        // Check if openId already exists (shouldn't happen, but safety check)
        const existingByOpenId = await db.getUserByOpenId(openId);
        if (existingByOpenId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Usuário já existe",
          });
        }

        // Hash password
        const hashedPassword = await hashPassword(input.password);

        // Create user
        await db.upsertUser({
          openId,
          email: input.email,
          name: input.name,
          password: hashedPassword,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });

        // Create session token
        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.name,
          expiresInMs: ONE_YEAR_MS,
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Email inválido"),
          password: z.string().min(1, "Senha é obrigatória"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Find user by email
        const user = await db.getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email ou senha incorretos",
          });
        }

        // Check if user has password (email/password auth)
        if (!user.password) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Conta não possui senha cadastrada",
          });
        }

        // Verify password
        const isValidPassword = await verifyPassword(input.password, user.password);
        if (!isValidPassword) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email ou senha incorretos",
          });
        }

        // Update last signed in
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        // Create session token
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true };
      }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          cpf: z.string().length(11, "CPF deve ter 11 dígitos"),
          contato: z.string().min(10, "Contato deve ter pelo menos 10 dígitos").max(11, "Contato deve ter no máximo 11 dígitos"),
          pixKey: z.string().optional(),
          pixKeyType: z.enum(["EVP", "CPF", "CNPJ", "EMAIL", "TELEFONE"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertUser({
          openId: ctx.user.openId,
          cpf: input.cpf,
          contato: input.contato,
        });

        // Save Pix key if provided
        if (input.pixKey && input.pixKeyType) {
          // Validate Pix key
          if (!validatePixKey(input.pixKey, input.pixKeyType)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Chave Pix inválida",
            });
          }

          await db.upsertPixKey({
            userId: ctx.user.id,
            pixKey: input.pixKey,
            pixKeyType: input.pixKeyType,
          });
        }

        return { success: true };
      }),
    getPixKey: protectedProcedure
      .query(async ({ ctx }) => {
        const pixKey = await db.getPixKeyByUserId(ctx.user.id);
        return pixKey || null;
      }),
  }),

  rateio: rateioRouter,
  participant: participantRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
