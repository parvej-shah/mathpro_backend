// Enumerates every mounted endpoint by recording app.use(path, router) calls while app.js
// loads, then walking each router's stack. No regex parsing of source files.
const express = require('express');

function loadAppWithRouteTable() {
    const mounts = [];
    const originalUse = express.application.use;
    express.application.use = function recordingUse(path, ...handlers) {
        if (typeof path === 'string') {
            for (const h of handlers) {
                if (h && Array.isArray(h.stack)) mounts.push({ base: path, router: h });
            }
        }
        return originalUse.call(this, path, ...handlers);
    };

    let app;
    try {
        app = require('../../app');
    } finally {
        express.application.use = originalUse;
    }

    const routes = [];
    for (const { base, router } of mounts) {
        for (const layer of router.stack) {
            if (!layer.route) continue;
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            for (const p of paths) {
                for (const method of Object.keys(layer.route.methods)) {
                    if (method === '_all') continue;
                    routes.push({ method, path: `${base}${p === '/' ? '' : p}` || '/' });
                }
            }
        }
    }
    // Inline app-level routes (/ping, /health, /register) live on app._router itself.
    for (const layer of app._router.stack) {
        if (!layer.route) continue;
        for (const method of Object.keys(layer.route.methods)) {
            routes.push({ method, path: layer.route.path });
        }
    }

    const seen = new Set();
    const unique = routes.filter((r) => {
        const key = `${r.method} ${r.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return { app, routes: unique };
}

// Fill path params with a fixed id. 1 hits the seeded course/chapter/module/bundle/admin.
const fillParams = (path) => path.replace(/:(\w+)\??/g, '1');

module.exports = { loadAppWithRouteTable, fillParams };
