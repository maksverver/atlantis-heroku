-- PostgreSQL database schema for Atlantis server.

CREATE TABLE "Games" (
	"game_id" SERIAL,
	"serialized_state" TEXT NOT NULL,
	"over" BOOLEAN NOT NULL DEFAULT false,
	"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	PRIMARY KEY("game_id") );

CREATE TABLE "Users" (
	"username" TEXT NOT NULL,
	"salt" TEXT NOT NULL,
	"passkey" TEXT NOT NULL,
	PRIMARY KEY("username") );

CREATE TABLE "Players" (
	"game_id" INTEGER NOT NULL,
	"username" TEXT,
	"index" INTEGER,
	"key" TEXT UNIQUE,
	FOREIGN KEY ("game_id") REFERENCES "Games"("game_id"),
	FOREIGN KEY ("username") REFERENCES "Users"("username") );
