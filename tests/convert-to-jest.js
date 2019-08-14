/**
 * Jest Conversion script
 * This script isn't the cleanest, and uses two different methods for performing global
 * replaces... but it gets the job done. We switched from using the `replace` method to the
 * `advancedReplace` about 70% of the way through, and couldn't go and retrofit
 * `advancedReplace` everywhere with 100% confidence. However, should you use this script as
 * a base for your own migration, I would definitely suggest using `advancedReplace`, which
 * uses the node-replace library.
 */
// import {sync as globSync} from 'glob'
import { execSync } from 'child_process';
import fs from 'fs';
import 'colors';
import { default as nodeReplace } from 'replace';

const log = (...args) => console.log('[jest-convert]'.magenta, ...args);

if (thereAreUnstagedChanges()) {
  log('Cannot run when there are unstaged git changes');
  process.exit(1);
}

const directory = process.argv[2];
if (!directory) {
  log('A directory argument is required!');
  log('Try:', 'babel-node ./scripts/jest-convert.js src/components/ContactHeader'.bold);
  process.exit(1);
}
if (!fs.existsSync(directory)) {
  log('Directory', directory.green, 'does not exist');
  process.exit(1);
}

function runJestCodemods() {
  log('[jest-codemod]'.blue, 'chai-assert');
  execSync(`jscodeshift -t ./node_modules/jest-codemods/dist/transformers/chai-assert.js ${directory}`);
  log('[jest-codemod]'.blue, 'chai-should');
  execSync(`jscodeshift -t ./node_modules/jest-codemods/dist/transformers/chai-should.js ${directory}`);
  log('[jest-codemod]'.blue, 'expect');
  execSync(`jscodeshift -t ./node_modules/jest-codemods/dist/transformers/expect.js ${directory}`);
  log('[jest-codemod]'.blue, 'mocha');
  execSync(`jscodeshift -t ./node_modules/jest-codemods/dist/transformers/mocha.js ${directory}`);
}

log(`Sup, time to run some ${'jest'.green} up in here`);
// const specFiles = globSync(`${directory}/**/*.spec.js`)
// log(`Found ${specFiles.length} .spec.js files, renaming to .test.js`)
// const testFiles = specFiles.map(transformToJestFilename)
// log(`renamed ${testFiles.length} .spec.js files to .test.js files in ${directory}`)
// incrementalCommit(`[jest-convert] rename .spec.js to .test.js`)
log('running jest-codemod');
runJestCodemods();
// incrementalCommit(`[jest-convert] ran jest-codemods`)
log('running global replaces');
runTransformations(directory);
// incrementalCommit(`[jest-convert] ran global replaces`)
log('done');

function thereAreUnstagedChanges() {
  return execSync('git status --porcelain').toString().trim().length > 0;
}

function incrementalCommit(message) {
  if (!thereAreUnstagedChanges()) {
    log('no unstaged changes, not making progress commit');
  } else {
    log('making incremental commit');
    execSync('git add .');
    execSync(`git commit -m "${message}"`);
  }
}

// function transformToJestFilename (oldPath) {
//   const newPath = oldPath.replace('.spec.js', '.test.js')
//   execSync(`mv ${oldPath} ${newPath}`)
//   log(`[rename]`.green, oldPath.split('/').pop(), '->'.bold, newPath.split('/').pop())
//   return newPath
// }


function runTransformations(directory) {
  function replace(from, to) {
    const command = `find ${directory} -name "*.test.js" -exec sed -i '' 's/${from}/${to}/g' {} \\;`;
    log('[replace]'.yellow, from, '->'.bold, to);
    execSync(command);
  }

  function advancedReplace(options) {
    nodeReplace({
      recursive: true,
      paths: [directory],
      include: '*.test.js',
      ...options,
    });
  }

  // quick fix for a jest-codemod conversion that wasn't quite right
  advancedReplace({
    regex: /expect\(typeof (.*?)\)\.toBe\((.*?)\)/g,
    replacement: 'expect($1).toEqual(expect.any($2))',
  });

  advancedReplace({
    regex: /(sinon|sandbox).stub\((.*?)\).returns\(/g,
    replacement: 'jest.spyOn($1).mockReturnValue(',
  });

  advancedReplace({
    regex: /\.to\.include/g,
    replacement:  '.toContain',
  });

  // .to.be.a and .to.be.an
  advancedReplace({
    regex: /\.to((\.not)?)\.be\.(a|an)\((.*?)\)/g,
    replacement: '$1.toEqual(expect.any($2))',
  });

  // .to.have.length
  advancedReplace({
    regex: /\.to((\.not)?)\.have\.length\((.*?)\)/g,
    replacement: '$1.toHaveLength($2)',
  });

  // .to.match
  advancedReplace({
    regex: /\.to((\.not)?)\.match\((.*?)\)/g,
    replacement: '$1.toMatch($2)',
  });

  // .to.be.an.instanceof
  advancedReplace({
    regex: /\.to((\.not)?)\.be\.an\.instanceof\((.*?)\)/g,
    replacement: '$1.toBeInstanceOf($2)',
  });

  advancedReplace({
    regex: /expect\((.*?)\)\.to\.have\.text\((.*?)\)/g,
    replacement: 'expect($1.text()).toContain($2)',
  });

  replace('sinon.spy', 'jest.spyOn');
  replace('sandbox.spy', 'jest.fn');

  // remove sandbox imports
  replace('sandbox,\ ', '');
  replace(',\ sandbox', '');
  replace(',\ sandbox,\ ', ',');

  // mock has been called
  replace('.called).to.be.false', ').not.toHaveBeenCalled()');
  replace('.have.been.notCalled', '.not.toHaveBeenCalled()');
  replace('.called).to.eq(true)', ').toHaveBeenCalled()');
  replace('.called).to.eq(false)', ').not.toHaveBeenCalled()');

  replace('.to.eq(', '.toEqual(');
  replace('.to.not.eq(', '.not.toEqual(');
  replace('.to.eql(', '.toMatchObject(');
  replace('.to.not.eql(', '.not.toMatchObject(');

  // .to.not.have.length - when not called as a fn
  replace('.to.not.have.length', '.toHaveLength(0)');

  // .to.contain
  replace('.to.contain(', '.toContain(');
  replace('.to.not.contain(', '.not.toContain(');

  // .to.include
  replace('.to.include(', '.toContain(');

  // .to.contain.string
  replace('.to.contain.string(', '.toContain(');

  // .to.equal
  replace('.to.equal(', '.toEqual(');
  replace('.to.equals(', '.toEqual(');
  replace('.to.not.equal(', '.not.toMatchObject(');
  replace('.to.deep.equal(', 'toEqual(');

  // .to.be.defined
  replace('.to.be.defined', '.toBeDefined()');
  replace('.to.not.be.defined', '.not.toBeDefined()');

  // .to.be.undefined
  replace('.to.be.undefined', '.toBeUndefined()');
  replace('.to.not.be.undefined', '.not.toBeUndefined()');

  // .to.be.null
  replace('.to.be.null', '.toBeNull()');
  replace('.to.not.be.null', '.not.toBeNull()');

  // .to.be.true
  replace('.to.be.true', '.toBeTruthy()');
  replace('.to.not.be.true', '.not.toBeTruthy()');

  // .to.be.false
  replace('.to.be.false', '.not.toBeTruthy()');
  replace('.to.not.be.false', '.toBeTruthy()');

  // .to.have.been.called*
  replace('.have.been.calledOnce', '.toHaveBeenCalledTimes(1)');
  replace('.have.been.called.exactly(', '.toHaveBeenCalledTimes(');

  replace('.have.beenCalled', '.toHaveBeenCalled()');
  replace('.have.beenCalledOnce(', '.toHaveBeenCalledTimes(1)');

  replace('.have.been.calledWith(', '.toHaveBeenCalledWith(');
  replace('.have.been.calledWithMatch(', '.toHaveBeenCalledWith(');
  replace('.have.been.calledWithExactly(', '.toHaveBeenCalledWith(');

  replace('.have.been.called.once', '.toHaveBeenCalledTimes(1)');
  replace('.have.been.calledTwice', '.toHaveBeenCalledTimes(2)');
  replace('.have.been.called.twice', '.toHaveBeenCalledTimes(2)');

  replace('.should.be.called', '.toHaveBeenCalled()');
  replace('.should.have.been.calledOnce', '.toHaveBeenCalledTimes(1)');
  replace('.should.have.been.calledWith(', '.toHaveBeenCalledWith(');

  replace('.shoudl.have.been.callCount(', '.toHaveBeenCalledTimes(');


  // .to.not.have.been.called*
  replace('.not.have.been.calledOnce', '.not.toHaveBeenCalledTimes(1)');
  replace('.not.have.been.called.exactly(', '.not.toHaveBeenCalledTimes(');

  replace('.not.have.beenCalled', '.not.toHaveBeenCalled()');
  replace('.not.have.beenCalledOnce(', '.not.toHaveBeenCalledTimes(1)');

  replace('.not.have.been.calledWith(', '.not.toHaveBeenCalledWith(');
  replace('.not.have.been.calledWithMatch(', '.not.toHaveBeenCalledWith(');
  replace('.not.have.been.calledWithExactly(', '.not.toHaveBeenCalledWith(');

  // remaining .been.called\\n
  replace('.have.been.called', '.toHaveBeenCalled()');
  replace('.not.have.been.called', '.not.toHaveBeenCalled()');

  // stub
  replace('sinon.stub', 'jest.spyOn');
  replace('sandbox.stub', 'jest.spyOn');
  replace('.returns(true)', '.mockReturnValue(true)');

  // mockFn.lastCall
  replace('.lastCall', '.mock.calls.slice().pop()');
  replace('.args\\[', '.mock.calls\\[');
  replace('.slice().pop().mock.calls', '');

  // mock function reset and restore
  replace('.reset()', '.mockClear()');
  replace('.restore()', '.mockRestore()');
  replace('timekeeper.mockClear()', 'timekeeper.reset()');

  // expect.any fixes
  replace('expect.any(\'function\')', 'expect.any(Function)');
  replace('expect.any(\'boolean\')', 'expect.any(Boolean)');
  replace('expect.any(\'array\')', 'expect.any(Array)');
  replace('expect.any(\'object\')', 'expect.any(Object)');
  replace('expect.any(\'string\')', 'expect.any(String)');

  // before after
  replace('before(', 'beforeAll(');
  replace('after(', 'afterAll(');
}
