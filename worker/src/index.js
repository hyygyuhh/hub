/**
 * ShelfHub API lives in Cloudflare Pages Functions:
 *   functions/api/[[path]].js
 *   functions/_lib/*
 *
 * This file documents the entrypoint for the worker/ folder layout.
 * Prefer `npx wrangler pages dev .` for local API + static hosting.
 */

export default {
  async fetch() {
    return new Response(
      'ShelfHub API is served via Cloudflare Pages Functions at /api/*',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }
};
