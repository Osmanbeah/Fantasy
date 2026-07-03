const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create admin settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      creditBudget: 100.0,
      numStarters: 5,
      numSubs: 2
    }
  });

  // Seed default players
  const players = [
    { name: "Zeus Kinetic", club: "Aether FC", price: 12.5 },
    { name: "Atlas Power", club: "Aether FC", price: 11.0 },
    { name: "Apollo Swift", club: "Helios City", price: 10.5 },
    { name: "Hermes Agile", club: "Helios City", price: 9.5 },
    { name: "Ares Striker", club: "Warriors FC", price: 11.5 },
    { name: "Poseidon Tide", club: "Warriors FC", price: 8.5 },
    { name: "Hades Shadow", club: "Tartarus City", price: 9.0 }
  ];

  for (const p of players) {
    await prisma.player.create({ data: p });
  }

  // Create default active gameweek
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7); // 7 days from now
  await prisma.gameweek.create({
    data: {
      name: "Gameweek 1",
      deadline,
      isActive: true
    }
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
