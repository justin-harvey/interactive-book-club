import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import uglify from "@lopatnov/rollup-plugin-uglify";
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy'

// Firebase web config, injected from FIREBASE_* env vars at build time. Unset =>
// empty string => the game runs fully offline (see src/data/firebase.ts).
const FIREBASE_ENV_KEYS = [
    'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_DATABASE_URL', 'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'FIREBASE_MEASUREMENT_ID',
];
const firebaseReplacements = Object.fromEntries(
    FIREBASE_ENV_KEYS.map(k => [`process.env.${k}`, JSON.stringify(process.env[k] || '')]),
);

// Optional "Support Isotopia" payment link (Ko-fi, GitHub Sponsors, a Stripe
// Payment Link…) from the SUPPORT_URL env var. Only an https:// URL counts; unset
// => every support link stays hidden (see src/data/support.ts).
const SUPPORT_URL = /^https:\/\/[^\s"'<>]+$/.test(process.env.SUPPORT_URL || '') ? process.env.SUPPORT_URL : '';
const htmlAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const replaceOpts = {
    preventAssignment: true,
    'typeof CANVAS_RENDERER': JSON.stringify(true),
    'typeof WEBGL_RENDERER': JSON.stringify(true),
    'typeof EXPERIMENTAL': JSON.stringify(true),
    'typeof PLUGIN_CAMERA3D': JSON.stringify(false),
    'typeof PLUGIN_FBINSTANT': JSON.stringify(false),
    'typeof FEATURE_SOUND': JSON.stringify(true),
    ...firebaseReplacements,
    'process.env.SUPPORT_URL': JSON.stringify(SUPPORT_URL),
};

//  Fresh plugin instances per bundle (typescript2 keeps per-instance caches).
function corePlugins() {
    return [
        replace(replaceOpts),
        nodeResolve({ extensions: ['.ts', '.tsx'] }),
        commonjs({
            include: ['node_modules/eventemitter3/**', 'node_modules/phaser/**'],
            exclude: ['node_modules/phaser/src/polyfills/requestAnimationFrame.js'],
            sourceMap: false,
            ignoreGlobal: true
        }),
        typescript(),
        uglify({ mangle: false })
    ];
}

export default [
    //  The student game.
    {
        input: ['./src/game.ts'],
        output: { file: './dist/game.js', name: 'MyGame', format: 'iife', sourcemap: false, intro: 'var global = window;' },
        plugins: [
            copy({
                targets: [
                    { src: 'src/index.html', dest: 'dist' },
                    { src: 'src/index.css', dest: 'dist' },
                    { src: 'src/manifest.webmanifest', dest: 'dist' },
                    {
                        src: 'src/support.html', dest: 'dist',
                        transform: c => c.toString().replace(/%SUPPORT_URL%/g, htmlAttr(SUPPORT_URL)),
                    },
                    { src: 'src/teacher.html', dest: 'dist' },
                    { src: 'src/teacher.css', dest: 'dist' },
                    { src: 'src/assets/*', dest: 'dist/assets' }
                ]
            }),
            ...corePlugins()
        ]
    },
    //  The teacher admin portal (separate page: dist/teacher.html + teacher.js).
    {
        input: ['./src/teacher.ts'],
        output: { file: './dist/teacher.js', name: 'Teacher', format: 'iife', sourcemap: false, intro: 'var global = window;' },
        plugins: corePlugins()
    }
];
