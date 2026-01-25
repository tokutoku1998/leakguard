import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import formbody from '@fastify/formbody';
import { z } from 'zod';
import { sanitizePreview, sanitizeSlackText } from './sanitize.js';
import { generateToken, hashToken } from './token.js';

process.env.PRISMA_CLIENT_ENGINE_TYPE ||= 'binary';
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();
const app = Fastify({
  logger: {
    redact: [
      'req.headers.authorization',
      'req.headers.Authorization',
      'req.headers.cookie',
      'req.body.token',
      'req.body.ingestionToken',
      'req.body.authorization',
      'req.body.accessToken',
    ],
  },
  bodyLimit: 256 * 1024,
});

const ORG_ID = 'org_default';

const FindingSchema = z.object({
  type: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().positive(),
  previewMasked: z.string().min(1).max(200),
  fingerprint: z.string().min(8),
});

const FindingsPayloadSchema = z.object({
  repoId: z.string().min(1),
  userId: z.string().min(1),
  findings: z.array(FindingSchema).max(200),
});

const StatusSchema = z.object({
  status: z.enum(['open', 'fixed', 'ignored']),
});

const ProjectCreateSchema = z.object({
  repoId: z.string().min(1),
  name: z.string().min(1).optional(),
});

const FindingsQuerySchema = z.object({
  since: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['open', 'fixed', 'ignored']).optional(),
  projectId: z.string().optional(),
});

const SlackTestSchema = z.object({
  webhookUrl: z.string().url(),
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendSlackNotification(
  repoId: string,
  findings: Array<{ type: string; file: string; line: number }>,
) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || findings.length === 0) return;

  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.type, (counts.get(finding.type) || 0) + 1);
  }
  const topTypes = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  const sample = findings[0];
  const rawText = `LeakGuard: ${findings.length} new findings in ${repoId}. Top: ${topTypes}. Sample: ${sample.file}:${sample.line}`;
  const text = sanitizeSlackText(rawText);

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

async function ensureOrg() {
  await prisma.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Default Org' },
  });
}

async function ensureUser(userId: string, orgId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, orgId, email: `${userId}@local`, role: 'member' },
  });
}

async function getProjectByToken(token: string) {
  const tokenHash = hashToken(token);
  return prisma.project.findFirst({
    where: { ingestionTokenHash: tokenHash },
  });
}

function getBearerToken(header?: string): string | null {
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function requireAdminToken(header?: string): boolean {
  const adminToken = process.env.LEAKGUARD_ADMIN_TOKEN;
  if (!adminToken) return false;
  const token = getBearerToken(header);
  return token === adminToken;
}

app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
app.register(formbody);

const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  app.register(cors, { origin: corsOrigin.split(',') });
} else if (process.env.NODE_ENV !== 'production') {
  app.register(cors, { origin: true });
}

app.get('/', async (req, reply) => {
  const parsedQuery = FindingsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return reply.status(400).send({ error: 'invalid_query' });
  }
  const { projectId, type, status, since } = parsedQuery.data;
  if (since && Number.isNaN(new Date(since).getTime())) {
    return reply.status(400).send({ error: 'invalid_since' });
  }

  const projects = await prisma.project.findMany({ where: { orgId: ORG_ID } });

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;
  if (status) where.status = status;
  if (since) where.firstSeenAt = { gte: new Date(since) };

  const findings = await prisma.finding.findMany({
    where,
    orderBy: { lastSeenAt: 'desc' },
    take: 200,
  });

  const topTypes = await prisma.finding.groupBy({
    by: ['type'],
    _count: { type: true },
    orderBy: { _count: { type: 'desc' } },
    take: 5,
  });

  const totalCount = findings.length;
  const fixedCount = findings.filter((f: { status: string }) => f.status === 'fixed').length;
  const fixedRate = totalCount ? Math.round((fixedCount / totalCount) * 100) : 0;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LeakGuard Dashboard</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; }
      header { display: flex; justify-content: space-between; align-items: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
      .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
      .pill { padding: 2px 6px; border-radius: 6px; background: #eee; }
    </style>
  </head>
  <body>
    <header>
      <h1>LeakGuard Dashboard</h1>
      <div>Open: ${findings.filter((f: { status: string }) => f.status === 'open').length} | Fixed rate: ${fixedRate}%</div>
    </header>

    <section class="filters">
      <form method="get">
        <label>Project
          <select name="projectId">
            <option value="">All</option>
            ${projects
              .map(
                (p: { id: string; name: string }) =>
                  `<option value="${escapeHtml(p.id)}" ${p.id === projectId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label>Type
          <input name="type" value="${escapeHtml(type || '')}" />
        </label>
        <label>Status
          <select name="status">
            <option value="">All</option>
            ${['open', 'fixed', 'ignored']
              .map(
                (s) =>
                  `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label>Since
          <input type="date" name="since" value="${escapeHtml(since || '')}" />
        </label>
        <button type="submit">Apply</button>
      </form>
    </section>

    <section>
      <h2>Top Types</h2>
      <ul>
        ${topTypes
          .map(
            (t: { type: string; _count: { type: number } }) =>
              `<li><span class="pill">${escapeHtml(t.type)}</span> ${t._count.type}</li>`,
          )
          .join('')}
      </ul>
    </section>

    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>File</th>
          <th>Line</th>
          <th>Status</th>
          <th>Last Seen</th>
          <th>Preview</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${findings
          .map(
            (f: {
              type: string;
              file: string;
              line: number;
              status: string;
              lastSeenAt: Date;
              previewMasked: string;
              id: string;
            }) => `
          <tr>
            <td>${escapeHtml(f.type)}</td>
            <td>${escapeHtml(f.file)}</td>
            <td>${f.line}</td>
            <td>${escapeHtml(f.status)}</td>
            <td>${escapeHtml(f.lastSeenAt.toISOString())}</td>
            <td>${escapeHtml(f.previewMasked)}</td>
            <td>
              <form method="post" action="/v1/findings/${escapeHtml(f.id)}/status" style="display:inline;">
                <input type="hidden" name="status" value="open" />
                <button type="submit">Open</button>
              </form>
              <form method="post" action="/v1/findings/${escapeHtml(f.id)}/status" style="display:inline;">
                <input type="hidden" name="status" value="fixed" />
                <button type="submit">Fixed</button>
              </form>
              <form method="post" action="/v1/findings/${escapeHtml(f.id)}/status" style="display:inline;">
                <input type="hidden" name="status" value="ignored" />
                <button type="submit">Ignored</button>
              </form>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </body>
</html>`;

  reply.type('text/html').send(html);
});

app.get('/healthz', async (_req, reply) => {
  reply.status(200).send({ ok: true });
});

app.get('/v1/auth/verify', async (req, reply) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return reply.status(401).send({ error: 'missing_token' });
  }
  const project = await getProjectByToken(token);
  if (!project) {
    return reply.status(403).send({ error: 'invalid_token' });
  }
  return reply.send({ ok: true, projectId: project.id, repoId: project.repoId });
});

app.post('/v1/projects', async (req, reply) => {
  if (!requireAdminToken(req.headers.authorization)) {
    return reply.status(401).send({ error: 'unauthorized' });
  }
  const parsed = ProjectCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid_payload' });
  }

  await ensureOrg();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const repoId = parsed.data.repoId;
  const name = parsed.data.name || repoId;

  const existing = await prisma.project.findUnique({
    where: { orgId_repoId: { orgId: ORG_ID, repoId } },
  });
  if (existing) {
    return reply.status(409).send({ error: 'project_exists' });
  }

  const project = await prisma.project.create({
    data: {
      id: `${ORG_ID}_${repoId}`,
      orgId: ORG_ID,
      repoId,
      name,
      ingestionTokenHash: tokenHash,
    },
  });

  return reply.send({ id: project.id, repoId: project.repoId, name: project.name, ingestionToken: token });
});

app.post('/v1/findings', async (req, reply) => {
  const parsed = FindingsPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid_payload' });
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return reply.status(401).send({ error: 'missing_token' });
  }
  const project = await getProjectByToken(token);
  if (!project) {
    return reply.status(403).send({ error: 'invalid_token' });
  }

  const { repoId, userId, findings } = parsed.data;
  if (repoId !== project.repoId) {
    return reply.status(400).send({ error: 'repo_mismatch' });
  }
  await ensureUser(userId, project.orgId);
  const newFindings: Array<{ type: string; file: string; line: number }> = [];

  for (const finding of findings) {
    const previewMasked = sanitizePreview(finding.previewMasked);
    const existing = await prisma.finding.findUnique({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint: finding.fingerprint } },
    });
    if (existing) {
      await prisma.finding.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          previewMasked,
          line: finding.line,
          file: finding.file,
        },
      });
    } else {
      await prisma.finding.create({
        data: {
          projectId: project.id,
          userId,
          type: finding.type,
          file: finding.file,
          line: finding.line,
          previewMasked,
          fingerprint: finding.fingerprint,
          status: 'open',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
      newFindings.push({ type: finding.type, file: finding.file, line: finding.line });
    }
  }

  await prisma.auditLog.create({
    data: {
      orgId: ORG_ID,
      userId,
      action: 'findings_ingest',
      payloadJson: JSON.stringify({ repoId, count: findings.length }),
    },
  });

  await sendSlackNotification(repoId, newFindings);

  return reply.send({ ok: true, count: findings.length });
});

app.get('/v1/projects', async () => {
  const projects = await prisma.project.findMany({ where: { orgId: ORG_ID } });
  return projects.map((p: { id: string; repoId: string; name: string }) => ({
    id: p.id,
    repoId: p.repoId,
    name: p.name,
  }));
});

app.get('/v1/projects/:id/findings', async (req) => {
  const { id } = req.params as { id: string };
  const parsedQuery = FindingsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return { error: 'invalid_query' };
  }
  const { since, type, status } = parsedQuery.data;
  if (since && Number.isNaN(new Date(since).getTime())) {
    return { error: 'invalid_since' };
  }

  const where: Record<string, unknown> = { projectId: id };
  if (since) where.firstSeenAt = { gte: new Date(since) };
  if (type) where.type = type;
  if (status) where.status = status;

  const findings = await prisma.finding.findMany({
    where,
    orderBy: { lastSeenAt: 'desc' },
  });

  return findings;
});

app.post('/v1/findings/:id/status', async (req, reply) => {
  const { id } = req.params as { id: string };
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid_payload' });
  }

  const updated = await prisma.finding.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  await prisma.auditLog.create({
    data: {
      orgId: ORG_ID,
      userId: updated.userId,
      action: 'finding_status_update',
      payloadJson: JSON.stringify({ id, status: parsed.data.status }),
    },
  });

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return reply.redirect('/');
  }
  return { ok: true };
});

app.post('/v1/webhooks/slack/test', async (req, reply) => {
  const parsed = SlackTestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'invalid_payload' });
  }
  const response = await fetch(parsed.data.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'LeakGuard test webhook: OK' }),
  });

  return reply.send({ ok: response.ok, status: response.status });
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
