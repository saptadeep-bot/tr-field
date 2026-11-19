// Turn the single-file build into a page body for the artifact viewer,
// which supplies its own doctype, html, head and body.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-preview/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const metas = (head.match(/<meta name="(claude:viewport-fit-sides|theme-color)"[^>]*>/g) || []).join('\n');
const links = (head.match(/<link[^>]*>/g) || []).join('\n');
const styles = (head.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
const scripts = (head.match(/<script[^>]*>[\s\S]*?<\/script>/g) || []).join('\n');
const out = [title, metas, links, styles, body.trim(), scripts].join('\n');
writeFileSync('dist-preview/field-preview.html', out);
console.log('artifact page', (out.length / 1024).toFixed(1) + ' KB');
