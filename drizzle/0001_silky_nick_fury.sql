CREATE TABLE `participants` (
	`id` varchar(36) NOT NULL,
	`rateioId` varchar(36) NOT NULL,
	`userId` int,
	`pixKey` varchar(255) NOT NULL,
	`pixKeyType` enum('EVP','CPF','CNPJ','EMAIL','TELEFONE') NOT NULL,
	`autoRefund` boolean NOT NULL DEFAULT false,
	`status` enum('PENDENTE','PAGO','REEMBOLSADO') NOT NULL DEFAULT 'PENDENTE',
	`paidAmount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paymentIntents` (
	`id` varchar(36) NOT NULL,
	`participantId` varchar(36) NOT NULL,
	`pagarmeIntentId` varchar(255) NOT NULL,
	`qrCode` text,
	`copyPaste` varchar(255),
	`status` enum('CRIADO','EXPIRADO','PAGO') NOT NULL DEFAULT 'CRIADO',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentIntents_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentIntents_pagarmeIntentId_unique` UNIQUE(`pagarmeIntentId`)
);
--> statement-breakpoint
CREATE TABLE `rateioEvents` (
	`id` varchar(36) NOT NULL,
	`rateioId` varchar(36) NOT NULL,
	`participantId` varchar(36),
	`eventType` enum('CRIADO','PARTICIPANTE_ADICIONADO','PAGAMENTO_CONFIRMADO','CONCLUIDO','CANCELADO','REEMBOLSO_SOLICITADO') NOT NULL,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rateioEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rateios` (
	`id` varchar(36) NOT NULL,
	`creatorId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`description` varchar(140),
	`imageUrl` text,
	`totalAmount` int NOT NULL,
	`targetAmount` int,
	`privacyMode` enum('TOTAL','PARCIAL','ABERTO') NOT NULL DEFAULT 'PARCIAL',
	`status` enum('ATIVO','CONCLUIDO','CANCELADO') NOT NULL DEFAULT 'ATIVO',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rateios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL,
	`participantId` varchar(36) NOT NULL,
	`rateioId` varchar(36) NOT NULL,
	`pagarmeTransactionId` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`status` enum('PENDENTE','PAGO','FALHOU','REEMBOLSADO') NOT NULL DEFAULT 'PENDENTE',
	`paidAt` timestamp,
	`refundedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_pagarmeTransactionId_unique` UNIQUE(`pagarmeTransactionId`)
);
--> statement-breakpoint
ALTER TABLE `participants` ADD CONSTRAINT `participants_rateioId_rateios_id_fk` FOREIGN KEY (`rateioId`) REFERENCES `rateios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `participants` ADD CONSTRAINT `participants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paymentIntents` ADD CONSTRAINT `paymentIntents_participantId_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rateioEvents` ADD CONSTRAINT `rateioEvents_rateioId_rateios_id_fk` FOREIGN KEY (`rateioId`) REFERENCES `rateios`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rateioEvents` ADD CONSTRAINT `rateioEvents_participantId_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rateios` ADD CONSTRAINT `rateios_creatorId_users_id_fk` FOREIGN KEY (`creatorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_participantId_participants_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_rateioId_rateios_id_fk` FOREIGN KEY (`rateioId`) REFERENCES `rateios`(`id`) ON DELETE no action ON UPDATE no action;