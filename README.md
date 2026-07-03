# Kinetic Fantasy League

A sports-tech custom fantasy league application with no goalkeeper requirements and interchangeable positions, featuring the **Kinetic Grid** design system.

## Setup Instructions

### 1. Database Setup (Supabase)
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Go to the project Settings page and navigate to **Database** > **Connection Pooling**.
3. Under **Connection Pooler**, select Mode: **Session** and copy the URI connection string.
4. Paste the connection string into the `DATABASE_URL` variable in `backend/.env`.

### 2. Configure Environment Variables
Create a `backend/.env` file with the following variables:
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?schema=public"
JWT_SECRET="kinetic_grid_secret_key"
PORT=5000
```

### 3. Run Prisma Migrations
In the `backend` folder, run the following commands to initialize the database:
```bash
# Install dependencies
npm install

# Run database migration to apply schema to Supabase
npx prisma migrate dev --name init
```

### 4. Seed Data (Optional)
To seed the database with initial players, matches, and default admin settings:
Create a seed file `backend/prisma/seed.js`:
```javascript
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
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```
To run the seed, run:
```bash
node prisma/seed.js
```

### 5. Running the Application
#### Backend (Express)
In the `backend` folder:
```bash
npm run dev
```

#### Frontend (Vite + React)
In the `frontend` folder:
```bash
npm install
npm run dev
```
The app will run at `http://localhost:5173`.

---

## Key Rules & Rules Engine

1. **No Goalkeepers / Interchangeable Outfielders**:
   - All players are completely interchangeable.
   - The UI places 5 starters in a 1-2-2 defensive/offensive flow, and 2 substitutes.
2. **Deterministic Initials Avatars**:
   - No image storage/upload overhead. A deterministic color hash and initials generator computes background coloring for profiles/players instantly.
3. **Power Chip Logics**:
   - **Wildcard**: Saves unlimited free team transfers permanently.
   - **Free Hit**: Saves a snapshot of current squad configurations in `ChipUsage.squadSnapshot` before applying updates. Once the admin marks the gameweek completed, the squad automatically reverts back to the snapshotted state.
   - **Triple Captain**: Multiplies Captain's point tally by 3x instead of 2x.
   - **Bench Boost**: Adds point scores of substitutes to user gameweek totals.
