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

// we need this because Travis CI enjoys hanging on async tape tests
const testChainFactory = () => {
	let counter = 0;

	const log = () => console.log(`Counter at ${counter}`);
	const inc = () => (counter += 1) && log();
	const dec = () => (counter -= 1) && log();

	// at the end of each test added,
	// check for remaining tests and exit if necessary
	function checkCounter() {
		dec();
		if (counter <= 0) {
			log();
			process.exit(0);
		}
	}

	function track(testFn) {
		inc();
		return async t =>
			testFn(t)
				.then(() => sleep(1000))
				.then(() => t.end())
				.then(checkCounter);
	}

	return track;
}

const track = testChainFactory();

test('watch one file', track(async t => {
	const {
		filePath, reqPath,
		result1, result2,
		code1, code2
	} = randomModule();

	await createAndWait(filePath, code1);

	watch(require.resolve(reqPath));
	const before = require(reqPath)();
	t.equal(before, result1, 'Correctly loaded initial code');

	await createAndWait(filePath, code2);

	const after = require(reqPath)();
	t.equal(after, result2, 'Correctly loaded new code');

	await fs.unlinkAsync(filePath);
	stopWatching();
}));

test('watch everything', track(async t => {
	const module1 = randomModule();
	const module2 = randomModule();

	watch();

	await createAndWait(module1.filePath, module1.code1);
	await createAndWait(module2.filePath, module2.code1);

	const before1 = require(module1.reqPath)();
	const before2 = require(module2.reqPath)();
	t.equal(before1, module1.result1, 'Correctly loaded module1');
	t.equal(before2, module2.result1, 'Correctly loaded module2');

	await createAndWait(module1.filePath, module1.code2);
	await createAndWait(module2.filePath, module2.code2);

	const after1 = require(module1.reqPath)();
	const after2 = require(module2.reqPath)();
	t.equal(after1, module1.result2, 'Correctly loaded updated module1');
	t.equal(after2, module2.result2, 'Correctly loaded updated module2');

	await fs.unlinkAsync(module1.filePath);
	await fs.unlinkAsync(module2.filePath);
	stopWatching();
}));

test('fail on non-absolute paths', track(async t => {
	const { reqPath } = randomModule();

	t.throws(
		() => watch(reqPath),
		/The watcher only works on absolute paths/,
		'Correctly complained that the watcher requires an absolute path to work'
	);
}));

test('fail on native modules', track(async t => {
	t.throws(
		() => watch('util'),
		/The watcher cannot watch Native modules or files in node_modules/,
		'Correctly complained that the watcher cannot watch native modules or modules in node_modules folder'
	);
}));

test('cannot watch everything after watching something', track(async t => {
	const { filePath, reqPath, code1 } = randomModule();
	await createAndWait(filePath, code1);
	watch(require.resolve(reqPath));

	t.throws(
		watch,
		/You can only watch more files./,
		'Correctly complained that the watcher cannot watch everything if you are watching something specific already.'
	);

	await fs.unlinkAsync(filePath);
	stopWatching();
}));
