import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@evenslouis.ca";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  const hashed = await hash(password, 12);
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    await db.user.update({
      where: { email },
      data: { password: hashed, name: "Evens" },
    });
    console.log(`Updated admin user: ${email}`);
  } else {
    await db.user.create({
      data: { email, password: hashed, name: "Evens" },
    });
    console.log(`Created admin user: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
