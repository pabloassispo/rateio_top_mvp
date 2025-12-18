CREATE TABLE `pixKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pixKey` varchar(255) NOT NULL,
	`pixKeyType` enum('EVP','CPF','CNPJ','EMAIL','TELEFONE') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pixKeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `pixKeys_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `pixKeys` ADD CONSTRAINT `pixKeys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;