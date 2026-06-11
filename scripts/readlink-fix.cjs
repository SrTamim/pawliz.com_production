// Local-dev shim for exFAT volumes (this repo lives on L:, which is exFAT).
// exFAT has no reparse points, so readlink always fails. Node >= 24 maps that
// Windows error to EISDIR; webpack's snapshot logic only tolerates EINVAL,
// which makes `next build` crash with:
//   Error: EISDIR: illegal operation on a directory, readlink '...jsx'
// Preload with:  NODE_OPTIONS="--require <abs-path>/scripts/readlink-fix.cjs"
// Production builds (Vercel/Render, Linux) never need this.
const fs = require('fs');

function remap(err) {
  if (err && err.code === 'EISDIR' && String(err.syscall) === 'readlink') {
    err.code = 'EINVAL';
    err.errno = -4071; // UV_EINVAL on Windows
    err.message = err.message.replace('EISDIR', 'EINVAL');
  }
  return err;
}

const readlinkSync = fs.readlinkSync;
fs.readlinkSync = function (...args) {
  try {
    return readlinkSync.apply(fs, args);
  } catch (e) {
    throw remap(e);
  }
};

const readlink = fs.readlink;
fs.readlink = function (path, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }
  return readlink.call(fs, path, options, (err, link) => cb(remap(err), link));
};

const readlinkP = fs.promises.readlink;
fs.promises.readlink = async function (...args) {
  try {
    return await readlinkP.apply(fs.promises, args);
  } catch (e) {
    throw remap(e);
  }
};
