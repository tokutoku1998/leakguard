import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateToken, hashToken } from './token.js';

const prisma = new PrismaClient();
const ORG_ID = 'org_default';

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  return {
    cmd: args[0],
    subcmd: args[1],
    project: args.includes('--project') ? args[args.indexOf('--project') + 1] : undefined,
  };
}

async function ensureOrg() {
  await prisma.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Default Org' },
  });
}

async function mintToken(repoId: string) {
  await ensureOrg();

  const existing = await prisma.project.findUnique({
    where: { orgId_repoId: { orgId: ORG_ID, repoId } },
  });
  if (existing) {
    throw new Error('project_exists');
  }

  const token = generateToken();
  const tokenHash = hashToken(token);

  await prisma.project.create({
    data: {
      id: `${ORG_ID}_${repoId}`,
      orgId: ORG_ID,
      repoId,
      name: repoId,
      ingestionTokenHash: tokenHash,
    },
  });

  return token;
}

async function main() {
  const { cmd, subcmd, project } = parseArgs(process.argv);
  if (cmd !== 'token' || subcmd !== 'mint' || !project) {
    console.error('Usage: leakguard token mint --project <repoId>');
    process.exit(1);
  }

  try {
    const token = await mintToken(project);
    // Print token once for the operator; do not log elsewhere.
    process.stdout.write(`${token}\n`);
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
