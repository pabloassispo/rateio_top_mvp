-- Add cpf and contato columns to users table
ALTER TABLE `users` 
  ADD COLUMN `cpf` varchar(11) NULL AFTER `loginMethod`,
  ADD COLUMN `contato` varchar(11) NULL AFTER `cpf`;


