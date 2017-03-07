import test from 'tape';
import Promise from 'bluebird';
import fs from 'fs';
import watch, { stopWatching } from 'index';
import { generate } from 'shortid';

Promise.promisifyAll(fs);

const randomModule = () => {
	const id = generate();
	const result1 = generate();
	const result2 = generate();
	return {
		filePath: `./${id}.js`,
		reqPath: `../${id}.js`,
		result1,
		result2,
		code1: `module.exports = function() { return '${result1}'; }`,
		code2: `module.exports = function() { return '${result2}'; }`
	};
}

const sleep = duration => new Promise(ok => setTimeout(ok, duration));
const createAndWait = async (path, data) => {
	await fs.writeFileAsync(path, data, 'utf8');
	await sleep(1000);
}

test('watch one file', async t => {
	t.plan(2);

	const {
		filePath, reqPath,
		result1, result2,
		code1, code2
	} = randomModule();

	await createAndWait(filePath, code1);

	watch(require.resolve(reqPath));
	const before = require(reqPath)();
	t.equal(before, result1);

	await createAndWait(filePath, code2);

	const after = require(reqPath)();
	t.equal(after, result2);

	await fs.unlinkAsync(filePath);
	stopWatching();

	await sleep(1000);
	t.end();
});

test('watch everything', async t => {
	t.plan(4);

	const module1 = randomModule();
	const module2 = randomModule();

	watch();

	await createAndWait(module1.filePath, module1.code1);
	await createAndWait(module2.filePath, module2.code1);

	const before1 = require(module1.reqPath)();
	const before2 = require(module2.reqPath)();
	t.equal(before1, module1.result1);
	t.equal(before2, module2.result1);

	await createAndWait(module1.filePath, module1.code2);
	await createAndWait(module2.filePath, module2.code2);

	const after1 = require(module1.reqPath)();
	const after2 = require(module2.reqPath)();
	t.equal(after1, module1.result2);
	t.equal(after2, module2.result2);

	await fs.unlinkAsync(module1.filePath);
	await fs.unlinkAsync(module2.filePath);
	stopWatching();

	await sleep(1000);
	t.end();
});

test('fail on non-absolute paths', t => {
	t.plan(1);

	const { reqPath } = randomModule();

	t.throws(
		() => watch(reqPath),
		/The watcher only works on absolute paths/
	);

	t.end();
});

test('fail on native modules', t => {
	t.plan(1);
	t.throws(
		() => watch('util'),
		/The watcher cannot watch Native modules or files in node_modules/
	);

	t.end();
});

test('cannot watch everything after watching something', async (t) => {
	t.plan(1);

	const { filePath, reqPath, code1 } = randomModule();
	await createAndWait(filePath, code1);
	watch(require.resolve(reqPath));

	t.throws(watch, /You're currently watching some files. You can only watch more files./);

	await fs.unlinkAsync(filePath);
	stopWatching();

	await sleep(1000);
	t.end();
})