-- AlterTable
ALTER TABLE "Gameweek" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GameweekSquad" (
    "id" SERIAL NOT NULL,
    "fantasyTeamId" INTEGER NOT NULL,
    "gameweekId" INTEGER NOT NULL,
    "captainId" INTEGER,
    "viceCaptainId" INTEGER,
    "players" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameweekSquad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameweekSquad_fantasyTeamId_gameweekId_key" ON "GameweekSquad"("fantasyTeamId", "gameweekId");

-- AddForeignKey
ALTER TABLE "GameweekSquad" ADD CONSTRAINT "GameweekSquad_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekSquad" ADD CONSTRAINT "GameweekSquad_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
