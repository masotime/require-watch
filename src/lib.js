import { join } from 'path';

const NATIVE_MATCH = /^[^\\.\\/]/;
const NODE_MODULE_MATCH = new RegExp(`^${join(process.cwd(), 'node_modules')}`);

export function createNode(path) {
	return {
		path,
		parents: []
	};
}

export function isAppModule(path) {
	return !(NATIVE_MATCH.test(path) || NODE_MODULE_MATCH.test(path));
}
