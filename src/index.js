import Module from 'module';
import chokidar from 'chokidar';
import { isAbsolute } from 'path';
import { createNode, isAppModule } from 'lib';
import { debuglog } from 'util';

const log = debuglog('require-watch');

const watchTree = {};
let commonWatcher;

function initialize() {
	commonWatcher = chokidar.watch();

	// configure the watcher behavior. For any dependency that changes, we invalidate
	// the cache for that dependency. We _also_ remove the key from the watchTree,
	// since on the next require, that node will be added again with the latest
	// information.
	//
	// We could also require the topmost node we know of manually, but modules may
	// have side effects when required that we don't want to trigger.
	commonWatcher.on('change', path => {
		log(`A change was detected on module ${path}`);

		if (!watchTree.hasOwnProperty(path)) {
			throw new Error(`Unexpected - watching ${path} that does not exist in watchTree`);
		}

		cascadeUncache(watchTree[path]);
	});
}

function watchModule(path) {
	if (!commonWatcher) {
		initialize();
	}

	if (watchTree.hasOwnProperty(path)) {
		return watchTree[path];
	}

	log(`Watching ${path}`);
	watchTree[path] = createNode(path);
	commonWatcher.add(path);
	return watchTree[path];
}

function watch(path) {
	if (path) { // if there is a path, we just watch that path
		if (!isAppModule(path)) {
			throw new Error(`The watcher cannot watch Native modules or files in node_modules`);
		}

		if (!isAbsolute(path)) {
			throw new Error(`The watcher only works on absolute paths - ${path} is not absolute`);
		}

		watchModule(path);
	} else if (Object.keys(watchTree).length === 0) {
		// if no path is specified, and nothing was watched before
		// we just watch _everything_

		// iterate through all current non-native non-library node modules in the cache
		log(`Watching everything possible`);
		Object.keys(require.cache)
			.filter(isAppModule)
			.forEach(watchModule);
	} else {
		throw new Error(`You're currently watching some files ${JSON.stringify(watchTree)}. You can only watch more files.`);
	}
}


// we go up the tree and delete both the cache and the node as we go along
function cascadeUncache({ parents, path }) {
	if (!watchTree.hasOwnProperty(path)) return;

	log(`Invalidating ${path}`);
	delete watchTree[path];
	delete require.cache[path];
	commonWatcher.unwatch(path);

	if (parents.length === 0) {
		// we have to assume that this is a root node we are watching
		// and we re-watch this node
		log(`Root node ${path}`);
		watchModule(path);
	} else {
		parents.forEach(parent => {
			if (watchTree.hasOwnProperty(parent)) {
				cascadeUncache(watchTree[parent]);
			}
		});
	}

}

function stopWatching() {
	if (commonWatcher) {
		log(`#stopWatching: watchTree has the keys ${JSON.stringify(Object.keys(watchTree))}`)
		Object.keys(watchTree).forEach(key => {
			const { path } = watchTree[key];
			log(`Unwatching ${path}`);
			commonWatcher.unwatch(path);
			delete watchTree[key]
		});

		commonWatcher.close();
		commonWatcher = null;
	} else {
		log(`stopWatching() called without a commonWatcher defined (${commonWatcher})`);
	}
}

const original_load = Module._load;
const intercepted_load = (request, parent, isMain) => {
	const requirePath = Module._resolveFilename(request, parent);
	const parentPath = parent && parent.filename;

	// we are only concerned with app modules that are a part of the
	// existing watch tree
	if (isAppModule(requirePath) && watchTree.hasOwnProperty(parentPath)) {
		// we start watching this module
		const { parents } = watchModule(requirePath);

		// we update the parents of this module. All parents will be invalidated
		// recursively by the watcher if this module changes
		if (parents.indexOf(parentPath) < 0) {
			log(`${parentPath} depends on ${requirePath}`);
			parents.push(parentPath);
		}
	}

	return original_load(request, parent, isMain);
}

// make sure we don't replace more than once
if (Module._load.toString() !== intercepted_load.toString()) {
	Module._load = intercepted_load;
}

export default watch;
export { stopWatching };
