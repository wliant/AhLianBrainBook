-- Create sandbox database and user for the sandbox service
CREATE DATABASE sandbox;
CREATE USER sandbox WITH PASSWORD 'sandbox';
GRANT ALL PRIVILEGES ON DATABASE sandbox TO sandbox;
\connect sandbox
GRANT ALL ON SCHEMA public TO sandbox;
