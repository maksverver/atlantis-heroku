-- PostgreSQL database schema for Atlantis server.

CREATE TABLE "Games" (
	"game_id" SERIAL,
	"serialized_state" TEXT NOT NULL,
    "next_player" INTEGER NOT NULL DEFAULT 0,
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
	FOREIGN KEY ("game_id") REFERENCES "Games"("game_id") ON DELETE CASCADE,
	FOREIGN KEY ("username") REFERENCES "Users"("username") ON DELETE SET NULL );
