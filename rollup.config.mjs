import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const plugins = () => [nodeResolve(), commonjs(), json()]

export default [{
    input: 'module/src/main.mjs',
    output: {
        file: 'out/server.mjs',
        format: 'es',
        name: 'hear-stream'
    },
    plugins: plugins()
}, {
    input: 'module/plugins/emote_frequency/index.mjs',
    output: {
        file: 'out/plugins/emote_frequency/index.mjs',
        format: 'es',
        name: 'hear-stream'
    },
    plugins: plugins()
}];