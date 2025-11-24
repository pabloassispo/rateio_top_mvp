-- Grant root access from any host
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'rootpassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Grant application user access from any host
CREATE USER IF NOT EXISTS 'rateio_user'@'%' IDENTIFIED BY 'rateio_password';
GRANT ALL PRIVILEGES ON rateio_top_mvp.* TO 'rateio_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

