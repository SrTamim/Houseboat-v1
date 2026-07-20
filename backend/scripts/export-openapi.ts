/**
 * Writes openapi.json without starting the HTTP server. Boots the Nest app in
 * memory, builds the Swagger document (with plugin metadata for typed schemas),
 * writes the spec, and exits.
 *
 * Run: pnpm openapi:export  → backend/openapi.json
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
// Import the COMPILED app so the @nestjs/swagger plugin's inline metadata
// (baked into dist during `nest build`) is present — gives typed DTO schemas.
import { AppModule } from '../dist/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  app.setGlobalPrefix('api');

  const doc = new DocumentBuilder()
    .setTitle('Houseboat API')
    .setDescription('Booking SaaS backend')
    .setVersion('0.1.0')
    .addCookieAuth('hb_access')
    .build();

  const spec = SwaggerModule.createDocument(app, doc);
  const out = join(__dirname, '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(spec, null, 2));
  await app.close();

  const paths = Object.keys(spec.paths ?? {}).length;
  const schemas = Object.keys(spec.components?.schemas ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`openapi.json written: ${paths} paths, ${schemas} schemas → ${out}`);
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('export-openapi failed:', e);
  process.exit(1);
});
