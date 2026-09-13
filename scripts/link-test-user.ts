import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const user = await db.user.findUnique({
    where: {
      email: "test@example.com",
    },
  });

  if (!user) {
    throw new Error("Test user not found.");
  }

  const business = await db.business.findUnique({
    where: {
      id: "cmtzqdk660000mw8iri2qo8m0",
    },
  });

  if (!business) {
    throw new Error("Demo Business not found.");
  }

  await db.business.update({
    where: {
      id: business.id,
    },
    data: {
      ownerId: user.id,
    },
  });

  console.log("Demo Business linked to:", user.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });