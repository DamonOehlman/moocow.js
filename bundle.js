!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.moocow=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff
var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  if (length > 0 && length <= Buffer.poolSize)
    buf.parent = rootParent

  return buf
}

function SlowBuffer(subject, encoding, noZero) {
  if (!(this instanceof SlowBuffer))
    return new SlowBuffer(subject, encoding, noZero)

  var buf = new Buffer(subject, encoding, noZero)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0

  if (length < 0 || offset < 0 || offset > this.length)
    throw new RangeError('attempt to write outside buffer bounds');

  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length)
    newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul

  return val
}

Buffer.prototype.readUIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100))
    val += this[offset + --byteLength] * mul;

  return val
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100))
    val += this[offset + --i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (target_start >= target.length) target_start = target.length
  if (!target_start) target_start = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || source.length === 0) return 0

  // Fatal error conditions
  if (target_start < 0)
    throw new RangeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes(string, units) {
  var codePoint, length = string.length
  var leadSurrogate = null
  units = units || Infinity
  var bytes = []
  var i = 0

  for (; i<length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {

      // last char was a lead
      if (leadSurrogate) {

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        else {
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      }

      // no lead yet
      else {

        // unexpected trail
        if (codePoint > 0xDBFF) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // unpaired lead
        else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        else {
          leadSurrogate = codePoint
          continue
        }
      }
    }

    // valid bmp char, but last char was a lead
    else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    }
    else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {

    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":2,"ieee754":3,"is-array":4}],2:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],3:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],4:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],5:[function(require,module,exports){
(function (Buffer){
var extend = require('cog/extend');
var pluck = require('whisk/pluck');
var flatten = require('flatten-list');


/**
  # moocow.js

  Play audio when a DOM element has child nodes added. What can I say, I'm
  making the world a better place.

  ## Example Usage

  To be completed.

  ## Ready to Use on Any Website

  Because I know how important this script is, it's been browserified to a UMDjs
  module that can be included using any script tag using the following url:

  ```html
  <script src="https://cdn.rawgit.com/DamonOehlman/moocow.js/v1.0.1/bundle.js"></script>
  <script>
  var newEl = document.createElement('div');

  moocow(document.body);
  document.body.appendChild(newEl);
  </script>
  ```

  Or you can use it on any site in using developer tools - load the script into the
  currently displayed page (this might be blocked by cross origin policy):

  ```js
  var script = document.createElement('script');
  script.src = 'https://cdn.rawgit.com/DamonOehlman/moocow.js/v1.0.1/bundle.js';
  document.body.appendChild(script);
  ```

  Now inspect an element, and you can moocow enable it:

  ```js
  moocow($0);
  ```

  ## Acknowledgements

  - [Mudchute_cow_1.ogg](http://commons.wikimedia.org/wiki/File:Mudchute_cow_1.ogg)

**/
module.exports = function(target, opts) {
  var observer = new MutationObserver(handleMutations);
  var stop = observer.disconnect.bind(observer);
  var defaultAudio = Buffer("T2dnUwACAAAAAAAAAACxXLINAAAAAI/4/qoBHgF2b3JiaXMAAAAAAUSsAAAAAAAAAHcBAAAAAAC4AU9nZ1MAAAAAAAAAAAAAsVyyDQEAAAAyiet4EC3//////////////////8kDdm9yYmlzHQAAAFhpcGguT3JnIGxpYlZvcmJpcyBJIDIwMDUwMzA0AAAAAAEFdm9yYmlzKUJDVgEACAAAADFMIMWA0JBVAAAQAABgJCkOk2ZJKaWUoSh5mJRISSmllMUwiZiUicUYY4wxxhhjjDHGGGOMIDRkFQAABACAKAmOo+ZJas45ZxgnjnKgOWlOOKcgB4pR4DkJwvUmY26mtKZrbs4pJQgNWQUAAAIAQEghhRRSSCGFFGKIIYYYYoghhxxyyCGnnHIKKqigggoyyCCDTDLppJNOOumoo4466ii00EILLbTSSkwx1VZjrr0GXXxzzjnnnHPOOeecc84JQkNWAQAgAAAEQgYZZBBCCCGFFFKIKaaYcgoyyIDQkFUAACAAgAAAAABHkRRJsRTLsRzN0SRP8ixREzXRM0VTVE1VVVVVdV1XdmXXdnXXdn1ZmIVbuH1ZuIVb2IVd94VhGIZhGIZhGIZh+H3f933f930gNGQVACABAKAjOZbjKaIiGqLiOaIDhIasAgBkAAAEACAJkiIpkqNJpmZqrmmbtmirtm3LsizLsgyEhqwCAAABAAQAAAAAAKBpmqZpmqZpmqZpmqZpmqZpmqZpmmZZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZlmVZQGjIKgBAAgBAx3Ecx3EkRVIkx3IsBwgNWQUAyAAACABAUizFcjRHczTHczzHczxHdETJlEzN9EwPCA1ZBQAAAgAIAAAAAABAMRzFcRzJ0SRPUi3TcjVXcz3Xc03XdV1XVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVYHQkFUAAAQAACGdZpZqgAgzkGEgNGQVAIAAAAAYoQhDDAgNWQUAAAQAAIih5CCa0JrzzTkOmuWgqRSb08GJVJsnuamYm3POOeecbM4Z45xzzinKmcWgmdCac85JDJqloJnQmnPOeRKbB62p0ppzzhnnnA7GGWGcc85p0poHqdlYm3POWdCa5qi5FJtzzomUmye1uVSbc84555xzzjnnnHPOqV6czsE54Zxzzonam2u5CV2cc875ZJzuzQnhnHPOOeecc84555xzzglCQ1YBAEAAAARh2BjGnYIgfY4GYhQhpiGTHnSPDpOgMcgppB6NjkZKqYNQUhknpXSC0JBVAAAgAACEEFJIIYUUUkghhRRSSCGGGGKIIaeccgoqqKSSiirKKLPMMssss8wyy6zDzjrrsMMQQwwxtNJKLDXVVmONteaec645SGultdZaK6WUUkoppSA0ZBUAAAIAQCBkkEEGGYUUUkghhphyyimnoIIKCA1ZBQAAAgAIAAAA8CTPER3RER3RER3RER3RER3P8RxREiVREiXRMi1TMz1VVFVXdm1Zl3Xbt4Vd2HXf133f141fF4ZlWZZlWZZlWZZlWZZlWZZlCUJDVgEAIAAAAEIIIYQUUkghhZRijDHHnINOQgmB0JBVAAAgAIAAAAAAR3EUx5EcyZEkS7IkTdIszfI0T/M00RNFUTRNUxVd0RV10xZlUzZd0zVl01Vl1XZl2bZlW7d9WbZ93/d93/d93/d93/d939d1IDRkFQAgAQCgIzmSIimSIjmO40iSBISGrAIAZAAABACgKI7iOI4jSZIkWZImeZZniZqpmZ7pqaIKhIasAgAAAQAEAAAAAACgaIqnmIqniIrniI4oiZZpiZqquaJsyq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7rukBoyCoAQAIAQEdyJEdyJEVSJEVyJAcIDVkFAMgAAAgAwDEcQ1Ikx7IsTfM0T/M00RM90TM9VXRFFwgNWQUAAAIACAAAAAAAwJAMS7EczdEkUVIt1VI11VItVVQ9VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV1TRN0zSB0JCVAAAZAAAjQQYZhBCKcpBCbj1YCDHmJAWhOQahxBiEpxAzDDkNInSQQSc9uJI5wwzz4FIoFURMg40lN44gDcKmXEnlOAhCQ1YEAFEAAIAxyDHEGHLOScmgRM4xCZ2UyDknpZPSSSktlhgzKSWmEmPjnKPSScmklBhLip2kEmOJrQAAgAAHAIAAC6HQkBUBQBQAAGIMUgophZRSzinmkFLKMeUcUko5p5xTzjkIHYTKMQadgxAppRxTzinHHITMQeWcg9BBKAAAIMABACDAQig0ZEUAECcA4HAkz5M0SxQlSxNFzxRl1xNN15U0zTQ1UVRVyxNV1VRV2xZNVbYlTRNNTfRUVRNFVRVV05ZNVbVtzzRl2VRV3RZV1bZl2xZ+V5Z13zNNWRZV1dZNVbV115Z9X9ZtXZg0zTQ1UVRVTRRV1VRV2zZV17Y1UXRVUVVlWVRVWXZlWfdVV9Z9SxRV1VNN2RVVVbZV2fVtVZZ94XRVXVdl2fdVWRZ+W9eF4fZ94RhV1dZN19V1VZZ9YdZlYbd13yhpmmlqoqiqmiiqqqmqtm2qrq1bouiqoqrKsmeqrqzKsq+rrmzrmiiqrqiqsiyqqiyrsqz7qizrtqiquq3KsrCbrqvrtu8LwyzrunCqrq6rsuz7qizruq3rxnHrujB8pinLpqvquqm6um7runHMtm0co6rqvirLwrDKsu/rui+0dSFRVXXdlF3jV2VZ921fd55b94WybTu/rfvKceu60vg5z28cubZtHLNuG7+t+8bzKz9hOI6lZ5q2baqqrZuqq+uybivDrOtCUVV9XZVl3zddWRdu3zeOW9eNoqrquirLvrDKsjHcxm8cuzAcXds2jlvXnbKtC31jyPcJz2vbxnH7OuP2daOvDAnHjwAAgAEHAIAAE8pAoSErAoA4AQAGIecUUxAqxSB0EFLqIKRUMQYhc05KxRyUUEpqIZTUKsYgVI5JyJyTEkpoKZTSUgehpVBKa6GU1lJrsabUYu0gpBZKaS2U0lpqqcbUWowRYxAy56RkzkkJpbQWSmktc05K56CkDkJKpaQUS0otVsxJyaCj0kFIqaQSU0mptVBKa6WkFktKMbYUW24x1hxKaS2kEltJKcYUU20txpojxiBkzknJnJMSSmktlNJa5ZiUDkJKmYOSSkqtlZJSzJyT0kFIqYOOSkkptpJKTKGU1kpKsYVSWmwx1pxSbDWU0lpJKcaSSmwtxlpbTLV1EFoLpbQWSmmttVZraq3GUEprJaUYS0qxtRZrbjHmGkppraQSW0mpxRZbji3GmlNrNabWam4x5hpbbT3WmnNKrdbUUo0txppjbb3VmnvvIKQWSmktlNJiai3G1mKtoZTWSiqxlZJabDHm2lqMOZTSYkmpxZJSjC3GmltsuaaWamwx5ppSi7Xm2nNsNfbUWqwtxppTS7XWWnOPufVWAADAgAMAQIAJZaDQkJUAQBQAAEGIUs5JaRByzDkqCULMOSepckxCKSlVzEEIJbXOOSkpxdY5CCWlFksqLcVWaykptRZrLQAAoMABACDABk2JxQEKDVkJAEQBACDGIMQYhAYZpRiD0BikFGMQIqUYc05KpRRjzknJGHMOQioZY85BKCmEUEoqKYUQSkklpQIAAAocAAACbNCUWByg0JAVAUAUAABgDGIMMYYgdFQyKhGETEonqYEQWgutddZSa6XFzFpqrbTYQAithdYySyXG1FpmrcSYWisAAOzAAQDswEIoNGQlAJAHAEAYoxRjzjlnEGLMOegcNAgx5hyEDirGnIMOQggVY85BCCGEzDkIIYQQQuYchBBCCKGDEEIIpZTSQQghhFJK6SCEEEIppXQQQgihlFIKAAAqcAAACLBRZHOCkaBCQ1YCAHkAAIAxSjkHoZRGKcYglJJSoxRjEEpJqXIMQikpxVY5B6GUlFrsIJTSWmw1dhBKaS3GWkNKrcVYa64hpdZirDXX1FqMteaaa0otxlprzbkAANwFBwCwAxtFNicYCSo0ZCUAkAcAgCCkFGOMMYYUYoox55xDCCnFmHPOKaYYc84555RijDnnnHOMMeecc845xphzzjnnHHPOOeecc44555xzzjnnnHPOOeecc84555xzzgkAACpwAAAIsFFkc4KRoEJDVgIAqQAAABFWYowxxhgbCDHGGGOMMUYSYowxxhhjbDHGGGOMMcaYYowxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGFtrrbXWWmuttdZaa6211lprrQBAvwoHAP8HG1ZHOCkaCyw0ZCUAEA4AABjDmHOOOQYdhIYp6KSEDkIIoUNKOSglhFBKKSlzTkpKpaSUWkqZc1JSKiWlllLqIKTUWkottdZaByWl1lJqrbXWOgiltNRaa6212EFIKaXWWostxlBKSq212GKMNYZSUmqtxdhirDGk0lJsLcYYY6yhlNZaazHGGGstKbXWYoy1xlprSam11mKLNdZaCwDgbnAAgEiwcYaVpLPC0eBCQ1YCACEBAARCjDnnnHMQQgghUoox56CDEEIIIURKMeYcdBBCCCGEjDHnoIMQQgghhJAx5hx0EEIIIYQQOucchBBCCKGEUkrnHHQQQgghlFBC6SCEEEIIoYRSSikdhBBCKKGEUkopJYQQQgmllFJKKaWEEEIIoYQSSimllBBCCKWUUkoppZQSQgghlFJKKaWUUkIIoZRQSimllFJKCCGEUkoppZRSSgkhhFBKKaWUUkopIYQSSimllFJKKaUAAIADBwCAACPoJKPKImw04cIDUGjISgCADAAAcdhq6ynWyCDFnISWS4SQchBiLhFSijlHsWVIGcUY1ZQxpRRTUmvonGKMUU+dY0oxw6yUVkookYLScqy1dswBAAAgCAAwECEzgUABFBjIAIADhAQpAKCwwNAxXAQE5BIyCgwKx4Rz0mkDABCEyAyRiFgMEhOqgaJiOgBYXGDIB4AMjY20iwvoMsAFXdx1IIQgBCGIxQEUkICDE2544g1PuMEJOkWlDgIAAAAAAAEAHgAAkg0gIiKaOY4Ojw+QEJERkhKTE5QAAAAAAOABgA8AgCQFiIiIZo6jw+MDJERkhKTE5AQlAAAAAAAAAAAACAgIAAAAAAAEAAAACAhPZ2dTAADARgAAAAAAALFcsg0CAAAA7eOkwxQ0NOTh2eHh4ePd5dXi4uvm6OPU2oRqWxVkxlQoUaIdAGJgoTyAJfchDc1qJJBOb/8+WFOlv1KxwJwPsmPSE6+E0vosGIpuygZ0Xl0ClbGd1qvcAVKP7QuYar3slhkrnR5fn0cqp8+MdXZnIh7rPO8L2X1cHRXiKSK28xMA+kmNvSNs9ptWAxmF701+M89z7BbWKLUhAuFkGnXlZa21Jhy/i6IpPzjZUiZ35f9BfJJs249n86jplFXw8klm1OYDbLYFOr/b7qeyiWJLPhAfCZBRpdOPCK1bh1OjVisuq4N081S3LtWNmm5ohOLmh6/RQm9wAU4v82C+/z0+PdtP7k4RtuboV7AELxgkDa0J9zqiII4KL4Ry0p2czgB6hKaXxkWW11yw2ze/Ct6rnIpD9vHBIm4NMuksao7gg99IMpNPmWXr4stzcViQYVM6WguMTnQhdMxbA1EmstocCSWMDPTHPkqNfQG7vUHBRtp7/0QJMjrVoIFJTRO/kmics4DeUTPp9SjG9LVlfjqzfmN5Oiv3wGb7S9009DxFzXLJPqvLiVwP2Fou9uFsQNfZWTRAeuwtPnbv+MAde0hMRCqOlpZM1KTol0dNKQkwTU3TZXFOYRssJIw0R0Jgr8ZmHhw6IeVG/3JmhMMNzf8i82dC0UAGOFvbLZymkhUTMq9MJ+oCKb17xptTXQ8dUCxIn/GFgnzBPE4Vr7nmNaAa8iBa3wZNZH0GPhrnj+P3bcr9ZNkkrGaJRnMwp1Gly/irt1Es15YAHpp1ZYm5hODZsXnfDwCACUwrtiXntTaKgY8BAOcPPV5bhpODmjKxkil9yKqoqmFjzw/7ylpPqbQq3sztN9u2bKw3M9Pemj+njtPAOVE8ixZFI+sMb69pf+lzjOoGPgotfjyx8Z84PW9WKFMDHU/LgYtZkZgwiz0DiJj6uWyzJwXKzuAqzPA2En0lh6HeKg21GOuXQhxZiKBwOwKsqggpq2VrJV111k/1B1V67q9XfP/tQH++nco1OCK2ofjdp5hxu+EeYSq1kD3BddeifX6gUjHMPLtIH5BjAD5qLXEUWgHwGh5m5sC8/70JsImBmAdMulEnclS+05rBSbWaZDfqxjzuG7gw+8WLKSk2Ude+Tl/dksJNl3qcZCugNDPWyb8SQ3EvlhIPhUe90nr8bmWOHNmfBEik9kBzao3NbhXX17bgRxdtaJ/vI8WfibRypYx+RXGyCJ+Lc356deGowvr9yh4pUOjWmGhidzegay32FLUVwWEL3hLyTS/p+BE+HA9rNua+0ubNt1XJlRdmy+ZFk4YM269io9ZXa3DoYfGJXIv5l0PfIuY/MaP8LdghUcYsqfgsg9f/4Ch0AN7YE6QTIgFAtle+STN6vcIvJPglwCS71VFOPNkqw3T94Exebi97a5LPHxxEaIPeT35JZLJx8jGxjEWscDFF2BKamBv3LFH5czNjjUwDmS/u2sau0ZJdLuvtIQWxFdqql0e7/p6lWHrYmAxSvc6irYYOloW4KIEes3qmWaXM2ZeyUJ8/pNYrq+BXUHNdTxAEw8WbYf8v/EqTSNoHPfz0LUvfsH2Pmjdt4d2IqIwKhl1sn0S+NxymFIBgqE6ztXMOksxl3xeO6MezY9/c8/uPCqBa3QUemogSQPye+Bl/nsb4BP7nUy0P5sKRncwLiYGs57NVpQygN05M6zzLwmlLN7ett9O8959PJoPPLPub5tMkVpVfGqmyJdeLWMqPj8rNGHeY40+nUpWhGAAZsbYGfTnCLrXlxpls+aH6eDICN+hKY0q7RfVpDYxsC/1+uvaS36U91cc54VYh1dGW1+M+pGoglQY9Yx9TjZsf12g9MwtHGyG2UBLG/OCUdZVgy8y41h4+uePWERflvpqMZK++WE0vjS3TG11vfx010nGLUMI5v6loBgLpteY3b0kE+fLyyKVe36UslvykJoqojxvnUa8iAR7oU8ME4kLBN/JcZhTzeZtCMBDYzA5qIpsqG4VRIXxMmLeG33MeOvLp1dNxSl6ZeSBtysb+/Gq4XyWu9JYS7GOpakQprvbVt/6dFwAJpfb8i9uq8bobj5dObPi4546dmWBjey3DwEOaU8GOTokekjOfuqi3AAA02L/NgGtr06vMZYNMtzTvTWf/5N3H0K0WsPQkNZiizyzo5F+wHfsAkBxL0wtW4dXM/Gxdh302tNCUhYCP6tfMPZeqGBIdxE7atpUdq73gqmJVlC3k3NSloBSzrL9Z3nZvaziA1smJmSRyMMADnuiziRE0F+h8M0evBCnWHVHqOqkAgIEJ0qQzLiollLE0a2er5qZXrP/04cHUzU9Db+0kV8xX0T7ozTIAW/F9VraV4IB3p5x/f//s0MG0tBx8Jq7znOA/YNwkEk7Nrzcjd8ohEjvajhpyn6D+npwE6ikDAgAAmHjhCwvZ8K91URNqeF/O8ZG91rifPSRMZ97vCWj0q1WRqF1VnWDZzuqGMGmdty/1H03PnJ9XiWxCZ76iL/vN7o9iITGzYkMZQNCk3gVD5l61zbTr4+Ivz3Zrcn6OnBJWixzRgiOoAABe+MsoI4jBCYt35Wq6xT7XWgUeGBwwpgGTRCeM0II+/zP5+W6zuf487toPu00Hzr8epvZKvaT7Oc8iqivzeZp5a1RwSjAfesha0xaI3Lu2hZfZCTho8KoXFrM6btB2N8IYc9x2cTBJTSVyXjG8jA0RyPfsxMjNn34CSFwimL88NdMTT32EcRjUFmlH9YXiozB3zpzQe5Aky97bMVdl4Cims8KMYgfdjORsRYDIaGftNoc2b1x1ayAA0fddHBIqyT5mI592rPcK3ASaMVYQI6+bLn/Jmb0vqkt0a//b369PK7Q0oAYA3tiziQkKiUvpOcQ8zTuyDJbOQwJgAKh8UKkotLCKcCo1x49kt+1PZv/IWI62Z5ON2DisWKZJNw4iSavEoPsZAJQA+PZ7B2ODlbC86a2htKOgPfl4pBDrZiQoMwvc0hHHGPA9uoeuV6MIViou45qPgxKtMgLPLnWAmRSC1RG7pHLqNj3UVU1/gQlf7ReOGCVk6/PFa/rOfUzaATE7zoWThHg/oXbfHK/fZax5KXRfD0qUA1qLSiCQnirVUGh5A/uf4FBWjnO1qr0Pym/7bAf+2hKoQZYAvhhUuAYyc3S6noOw5L0etT6IT2BwQK0A2ulEh5QViurc6+3LPHv7ywN3/6bmtVt977Kmo+O59BQXYBx3adwAoIBFaCKYce5USc6c0E5Oh7eQ0igkO6ld3FOvSJ4Rx6maYElHex4zG81qHCZybSakN/SZ/bLCJ2rfQd97iFUz4jba/G3A5ed3VtX6vW53Y0F6azJg3VCdU6o142dXeme2kBtbBXTzc8bgGYYCdy7heaM++91UEmIJ+aeoejmz0oTvHd2SPF7Dnuev9M9j9D3D0/fLHsQ7Ju8vfX4574OFO79DA/43HFQXkLLQyz2XrfE7dW3rQwG6Glsdo1Y6pBWtydf798PzQ8bNoXOv3O38TzIyn6koc7KPUQG+CLKrQmtmKP8Qe6IIYMAS8bdFfush5pJhFeyP9OmIgK3SdLbr67G0gw33+tfwI+XFAGTusVqmjuKj38Y6JBijrJuJierIphVs38OU+yWJ0YsN130YHKyXd5PWT5zzk3gtsm6Z9RVlOdXs+MuRQ+NbQRZshfAyrlvzaxpjYBhR+C+9x+oCShGlh/tc6JHwLvS0DAD672Odk+oHWM/9MHW0DtPyfXUe6x3CEgCeeAzRDMJO4MVqCvR9tPWE0sLgAQA7HWBHADCOrVwhpz0hK4qjV39HVjfETn/pub1igxNqw1bbTvq1TidWlLAeZT+4lOB4k35t3chMJACAwmLrPWxchwaqBR5KXMJ+nezxmZlSi3n55CS4j3XGhZIARAAIVkgmwdciHZh3fX3paCyI+B+gixViIOs4Xn44fP40dwHkSCYCC2FrbVI0T2UfK8BfwUjZV2PsZKsXldsabQSMLrODgOqEP+eI1oKe0tVVWV5x4o2Gifde+/+ye4aenQJIIP6XiNzW8gM2XaIwJWqulTecjMatUWAHfmi0iQrmYqHX4UIMJN7TM1R05BJaAwZXA9njGBPHSpNaUfFjTQmo+enHKGYjJPnux/rCQ3joKecZJRqzUlbbh4lCB1AI8yVocQBbz9SpGzNu2hKhlkG/m/EGczcQ9u736YyJ2k51UOsdkAWo+XeY9kP1P74Wtcs1r6e7joBP3UcTgrpQM2JakKhF/XntrnQy73u8PMyWLXcuTaBDB43fvSw5yH1JoCXE2PD3s5Q9m2pf5tTyPfXfw9R1oL7K7xkzqN003dKscrfmaPk7fVO4TupElIzFuLjyTGt3DvHIGll6YbGZIAE+GMxbDTxvyDIOSHmftPVhsQMzi0AyWeiASbVVln0Pekqbvs5/4YFhWrvzwW0rbwOZTwqRzHGu0SJNZe+KagwALvjqelr7FFvLKt2XOthWof4Y9WmNUjs3AP/6lBEaSRv5y91xWRVpWwNjC3/az1gk6ZaxX6JrjiLgPV+arTWwpOYBnXBnRuebKsy8cfcUXxK4lKa0V0afOHuXVkoabekRjyjoMxDjxCGM+dlcKr22Jvv52H9YG5pxBs6yKdTY5uBgzFmcb662lW1ZbVTO7BX5h1IcW12JifTTQlEbycke4jg+/ChBaS0CPnjMKx3ktRtEbNmPAioJAQfsBIALAPqSeQCpUopDStZY2t7O1Hy26BoJh9ZOIk8+DbenOEENTdMMLVqq7vculNAUcczbG6FWAbDKg4TEu0nazFqqxRBdmi5VzZpLvQcgvuG5nYoaFJrZTadHu7tlNYUh9xOVewbg/31zFBJxoNISMiEpcWdpzJLo7d3Cg59RHZMuDMuEpuVqSXtXsi7pYe9stlkO2iHM9T9KNlVxWDnjDlYH0xNgafLgonlNYXcFVzNgHX/O/dr4LJYtYdolzhQB01LJqg5Wqrz3Xk8p8Z0+FAD+KFQJD7rpeOg/aJ1qeNiPJBU2JPkCDADZcwD5VLNi5QxTGALzOwem3JUNEjAljwt51UpCO5a4KCOu/jdOEhpAcGmqvpxuttgp4FUuy88j/ykA0jw4IkvCoA9OknMw9N8Fo3S4BmhfcueGwO5Z5DQmcXLQ8zYZj/57Gl5FSocEiluk7LVpc/lbWVOjnkbDCcNrMXIlRgazWcuitY8ESknHdtB0m3lFn//3apMPr4cgmG6Gr1wTRT+/qNQf/k7YB9dW/tPKc8FvLQnbsErFVqsTx0IdAP445AgDYruQXQ8OV12gh/cI0hAKC9nAOcAiUPMASYWYWelE0Ti5Cd9i0rvclenxTHS5JsY63LWGGJ/qaSjJCiNd4xkIVeXQ32XGBqIQWy8Zhrdh0kbLJZT3OGVMvf6q6a3iGJ0SGu7tyUBwCSovtf9O6UTRzPpU3id3aq4S5fR1R+KfFTS41Bl5mjhRrBC0jQ1v3s2uXRKdYJS7Xqd9W4QqA+X91lS8xmLjjg5zznKipRVBW1McbH9RuLMqHTlmMcUMts3hC3ryUBGxFeXp1Y8Hh+IzSh2OUgUAT2dnUwAAwI4AAAAAAACxXLINAwAAAHKauAES3d/V3dnY8env4ePo5+Tu6vP2/pgMUALdPKjiOi31wO+/R1qecJBIYADIOk8BY0XZalJphSuVo0mTsjW2txseWe77MonrTWtS2yVbViWgq/lBBSigSZSn5l9DoZpOxCOQJ343AwPVfM3esjK13bTlWBITcHrDklz9Xk1upb2lNRhMMIL7Cz6Zgpc3lrwHWRSBSOqYdZ02JC1Q+m43zktARJVCgE/Zu39IHiboz34XuMG1Dvfnirq97g70RkoDHACzvbdonvG7L0roofrxMKpFHCnrweing5kXFCniEP1U/b/yfWJzoSdznaSJvVXgtgEemQzIAjHcoF3Hup7g3f9YwpOaRAADQPY8CVo5akN6QocQqed4K456omwLHRXA5a2+ZmjbS+cnTXJdeKR9CD2AAuU1lbUZOGoNKO6xqzPOh8gaghHAFYYRg9KXAh0f2mMR+ggfSsM/A1V/RdBAfBtAggQppznW8EG9P6kQLjLD0PrrOYm+zWJWJdQMi/NZeoeQBwfnia9v862bY5DzU4eSx+soZ1SFwiDkgRO94uDx+QVHE5LTDVanlVeU/RKCilUf7777MQhY/7rJZ+3l0eTZ0YXLwy+GLYA64Km8bRUAPnm0UYLKd6zya5rrgt6/m8VnI9sEXbOggNZoQ1TaOouzbav2/veyyWo+nHn2lQwHYl4LacJer0uUicuNDc9VGhVCDKrka4hkAGmsdiqfUTAA4DGRTJxBwI72qmnSgLaJNOwo91EWTcLGCUskgGBe+XpCqb0OJqW0kLn533Y6Gvr5pc1kP03fCwjZ2FfTZZZRLqKtZmo0vcCIHNyIyiX0ZxIddRWRoztBXesjZ2PJvWADYM+gqDJdvL5Vn+9sW91rBqjiY3Zb761is7UJvmY23GK3hDsAXrkkyQTt6sVDt3AI6oEevwfSlhDkMBR6uXkFqMprLZxwCjk9pxqfRWAS/kTLedrO1w/b6ZHc7R6/IQVf9FW7SVKCswrSlHFm3mbZJpKmtpN6/psAkmCUtf2Yub74Jt7FkPcWQLeyfL5lnxOLBeOSxZYL4k4b3jjomRCEVSjiObLxqcE5S0PR5Ys7FXoqUWf2DQFYr/VHWHrbJ1hD1rOPMzghLTDFsExBRIa7mDEowFkijHzvltYhbeix5Ip2hNiv3DqH+HbNXstWzQPeUzcFGc0P0A1FLs/aSofDNiS+qcTCgby8SQ/LMh2pHuCh+0B4UpOkiwVg0IHcagJNEgoJpUkRQrv5rV5bcdf9akeo1sQiN5vU1aBLuWqVAUvQq9IGN6t1GhhUXsxw7x2pdSMS8t5xdDYmudC2wsy76VwB7RB6EW8RuYWP2IJIMKY2i5JaUbfXl/cVLYyAGsdLaXNdazXYPy6SO0o0y4SBPyGByt/R5q8LmXNdjesjbG66UKppmw82XBKUZTdf7ypv4o85ZM26xN8/C1Qy/ezztg81/aQh9ypLcDW2Jez5jay/hMiv/yKPEoChvqmkNIK4evHQd4m6wLfmY/+lYBAYPJDvZJM3nlZaEI6501/knwzeePLHNaX+66c74+3rkiZKCPuZdaaAvydGccUhq9FkVJm4AAjIEAdEc3vhcT0fFO0PRfXtz92jAIOIBkgYGERxjZTM9dtUizEJYVoPaF/c9OnWGzGuCY+M/ujrVYloNCCpaodau7RD+ZKA4XX175B4zmmPHYjUnLjQgap5plceZlvRDEqYDdd2Ygw68kIfbG1Ei1tjsLQMlezG1MgBTWlUN4RS3eiLLeNoYbRMDe7iN4smPqrsWkReEVZ9l21SXg3vbTZNhQ5NbTMmVw4gwcEB4DQAYANIndPK9UkH5BRnfcWor+08b3Yhzdw17361f8vUf0O4pqfIeUpYOfMcnF9g/At4yGc+L02qSvyoOGGLH1z4NuUIq6G4kEq7EQJl+o/c9N1K2EKkApkg3BZuldj4W6YbGxcylIpRxDBLqxSvU4C5cJIH/re9DLELHdFQE8vSr7PcIe5h3PZI47V+N4FYRaFFxLgIcWUZLxItm3hg1mdz9E8AWxVmdUilmJvzpXwH6p/PjaB6SE8ouOifq402qmndbVfNgsX0BW1aWfCef80BAH6qjM6DufqwWDJJXfO19lcbpDoGlgArwLQv1YmTI8sUX998aQ4Tp8UIP+cTmy3+Z+rv/3o7s1YT2ZnLFNN2/m3UtESlB4aLOh7xZJhct96t3lx0XYidaQOaWV/i8t0nBF5hdg3s3DRjQdDGhAxsI3vznOaEoWfpppzvBdhhCTSr6O2EjG2z12mXNpbgS1C/55feMeWzzSzsrfeKgZC7XBvRvlNnBW+N/n13ksK3RvX875noXSHUWRSCjpOrlLpUPvDZQXSJH0h0T2aH6iCZSj+D1EVFo01wZCqd2iFSszoRWuKHyu8Cyx4BXqlEIiVGiJWItYbOr7Dp4ixXAWs/AODKAwc4iGEALDugaWNC1E5KOiCX95g3vl/JNehvreRNH5/sV6aZZSzJLLIhkXt8v7a+FdpTIbhohRzfhhYk6Il2ppVvs864a3X7st9UX9O21UIIioCiVjbmchM9uhdLArPxX7YAh9K+Aawtkw+t+zOgFTpTeSLyqtbhV7RgP4USqkKMCdAeO8VS3NDZg+RGJu6u924yXstDjBHtfrcNltc3CsR3q8Y4hwQrpy+W+A24qaBkwzHPN2rBIRiX4Fp1jvrWAsmt4K0h/FZiPO66ztxrjbwGlO8YIAP+qaQugWY/Olcf+Pv8svHYc9daOr1AJ7R1CrCBybIDyi9jHNFJHzD+f7R028UH115XytUkHsW7mTmURbevhR9SvsKt9eQup0nhSJHMVUHEN/XJFv0W5q+r9KhT7tSCGPdoWdd5ayP3vohgjagOcFkZys1rj0qXqBhLc3WsmA8eGnlviHGokKM/NuQY+sNsoLcVkrzjKbbqgEGY6XeAqg3GiG484g25vQ5BYkfiwJ8QKkqJd0TT5TrLwHAuSnPfVNDR+u3UaqLyf2oNN3WxNgpHWpQ7tRfxkWRzMA9bFICbNwN+mtTRR3PE4uqKba+Gzy8CNS+coPkc2AS2roGx11YrG9mRWQSiH+4qOp+uLdnuTr7OVknO6o+ws6qWGUVZArEN2vA71g4ChOT5+EMhFEkuf3erttQEYT+y3bqngv9Q1j2lNfZH1/Pt2iiyMBdyJx1ZxWYFDJdPz7Wfql+ZTGDCxhvcWUpMrDfkM8gvWpWpjVmncaRXpoQG/Vj2orI2840X3Io2WAmGZ/8HYhGBubhFql5rinMCJ+U0JZXZtBcK0PqI8riRP3C8kOGx1og+NUKFpI9t8P9q1Cg0tX5k7ll2ACDPBf6pRKZGWIgsd8lR2ho+X0oy3GUg9H3oWJ4CJr1qk+i0V1kE0suj0qemxYKet504NXV3z3z4wORg7jy9N0vHxp9uDvPbyxBXB70Y5m8vCooAA1YyBSBwE/pXqlyleoSFKNERpUPhBjcOkfstvgsOYKSTiEmxZCGZax6EqtpiorBNksx+V7ew1iwAm5fzX57+a+t/M3LCC4qzxA7S2X6+SfcsDgVjxKK5EZrUQROzyPEATWxIyDvhfSAx9TF0qUlk5wiYE1hGX/Ho2tyGkTtYso+K7DwJpDQhTo3F1p7U0Hltynaq4htZBACeqUTSA+lHxnAApbQavn1zLt/pK1NWsyMAnByDAKwA07RPOeU5HQD2Mdec/dqcOGpNY8P4ta0u/PEvozLyrkDpVFUebOr7hbo6Hel1lp85TFq54IFHpIbkD/FV9EpczRE6bhKiQZtUn2PZNBXxxnh2JmGt4ZOXH2A1zCjdathLPyBINxYx4z9bps1lEkBF2zquF2HssVmJ//dOz6fbvNGecn3/Ld5VezlbFf46BYdiBVFY+KdkSinTMuYGlxBvr+Dqp5OAHH8RjmEYGHRmTwOJwdIPJdSK3ArlDoWVlvKfVmIuAOQ5AAD+qQSmQaQXVYyMpejuk0udPjGQnGwBApw4UAAbwAyg0pBmVlxAvKbRxf5EGm9SvqaYkvV71R0yIjxZF9230+OUbeyvJsQbiq5Vc75LeBTp4h0MyMoqjTwx/aN6LkWatBHJ0/fadXDQsL40pw0Q1Ntbb6aRq9CeW+X2CNMSrLqmbeBjAEO4/C8/TLi2hLss6l6C7iKNkvX6RCXQ29WNc87oBzz1udgWZfaUzFqthXyMUiu1Tlvax3JNc6du9npnpSL3XbWxOlOQqVrn9GwVlbOcbGlXNKsVZmC2Ug+FNO/ptflkWAAeucyCHfAHwECx9wb4HbKwcIZA0NtgEVdHY0jmwUSqzycFEwtoengVLsetaXawNg7tBbs6i/XR/VxvvbQ9HRC6jkIl6sO2yXsLV8y3ThnZkHiLyGT/Smps8GPb47Pl4+W+trA+2l/jiWOJITV99kY+IjeAkJPAkjwZcQA6Ds8egT9KfOf2GoBINBJSRct9d6SCcLvvyNcZ9IG6k/Yel1tIlPgWsNxe1IbuSuAvIpn7yGtxp8iBST6kSKRgl79sEKpdCjjrnNVbRqwVTaDEsO7lm3Kpx1hpxGkjXr2yK4hEbA61ZTUWqlegt599jgAAPjq1/Z5MmdHsaH1C7/82cYXvEOkD/N+EW8Ah4AErHGYcyICnWmYta0ORMZ9Fksb4/nLiuYOJkUhLhp79eT1BapALEL1y9h5OnYA3IRvfT9dka8JUEO82kRjHwTxi2DG5Th1M6Y9me2KoyfknACIYQvcpPqq77h2jtISBe+J/emwB3kTVkE3PO16IhiWxJQAsj7p/yx5ILqbvEjduycelaHmdCpF5KqivSiQYtCtu7G+rIXI9vuFwTF/K+dYSjkLZbMHcS5KAj5ZxMQ10jqM1eTO/PsSPWgvVbFekTBiYLIXr1ALw9leBYQAAnllV6Z5hYNAwKbwPaSj8TVcScE8Jfxd2SGAEADYQZADKH31ndHnSIae1wUj+mRydRdLACMOmdskRuyockTJ7Re+0WNFsPB5JsCgQ/0YO/igxpgkAjYjPMHZYaklinS2rzb3mc/V2J/di/ecL9wICRrGWAL3G2a+f5F8xdR5ZhIYZMFeMR9QsiBxIg4QZEuFEAEuRDhgUZd8NRIxx/VQfciOL/yimNaf7YhGZxlQTHX0FnOiBcSIWz1JOqy3wWkgOwKfUhO8oKo8FiZBqI2KvMMXZVfJ++UGUk6zMXRdTS+g7YgguKWxa35yqM00OAmCJxAEA/pgdgreM6rRtYlGc9zdJFf+rdCEAAA7AIHCgAfhTANrBKLe+1kkxkExV3s/vHr0o42KoDnMIT2AllHJb6tsi1QEO5PzrsVaqAoWMtvpOnFSZN/t9o+6ZnCvlAA4V9S5c1Ml66AeUtcpZbbwTHgyus9pF16YuVhS42pKYiixp1HZE7tNLdQmEnlS1WQI4OSvSJ+qECmXsjV7AyhrvBj6+brjoDld+93oUzKRs0KP2g7IvafN3HrGM7w05mffhTIAp/Tc4SwqFkTuVAdTBV38gTlaW2FmfSgpC70TuKOs9FuNNMp0iN50aAXqCXiZ+hKRRpqnPKngAT2dnUwAAwNYAAAAAAACxXLINBAAAAMJWdwIS9Pnr8fLs7+rq8unw2t7r5uDlfqgdTmwz4qBV1kl2/ZKSavx3gisJwr/ehS0Js9wazA10eQEAqK5PNl6RFvhxUybierY2Fcm+jWwRZEV79f/MLZV97WcTLtlGH1xMKAcLOjhojkqD38uepSUO1MHma/xSj9NCUwwl12Sb8lxaZk7VU7Ihd1WUIcz0RdGpCJhp+Ew/ctv7jSo/kbA1bnzXpW+Rad6T9XJ8RAdUgUQ/9bpeljCckP02umcJg9mE8jM+dAqJ2PTcYr62kp0YPCxUmrj3hW7SqcYLJUXIVeKxsrga6wHhznc56Knb5gIpEAmHvR3EtHPd3knpmXqsOGOt9spuSg5CBx6ZHYBnxjAksWed4/Z+pKvC35qSAAA4gLIGf9ABsARoTTIaE1MLcGqHWvaiualnWFzZs5lmjQoYgKRAKvqjxKYTJT73/edp6MJT2A+85XSlquLWw5b9ql+m3F6UwWDiKuEaOkiduOy3llUi0Xp4MR6q4oXgl4Iq9kURE4rHT6JKYoZxofk6NxCvQWoELD19wc82nCyXdLrdJYSkrw5zDS53wkWgwh0a14M3KfAiPZMEEZ/M+xOwcHcnPmPpAEXfpU/E/ZVM+TUm1ayYbBE8lLV2aH9bqUEoOtjEZRI6ZzzDnM78hyBDNrxBC8Q5LTpgib2Y0vwN2yBwA964HU5cMpDYANPH8rF2EnYgKe2XAj9o3RIeB4CH1iXlO9kw8E/TXVqWLqri3TXIdI5yKxgZ5xCg+zqiJ/w9Zwo2qGCNt6Wt9MmEMUez0+lUqE5Db2SVsE9GPAaIWjymhHx0XqK5RWxRgaIV6DT2UOdOSADGP/57Cu87GnCUTST8YgaCKENPMZ7izPNcKXEkXmntvMtY/6ZaF07GlGWrGWHEjXanWuNRiFfFfrCFkvaW60WVY8SUU0x7rpZyVTS76rNSnDUbUJ68JZOue/nlOlPzsG6ltDtQI9ZsmyzW+nyNrs8Ccxf2dfYbdwA+qc2jM4NRNBkL+2PpM/qFIBjxjwOi1A5MAXAAgJvmK+kzSZswRYFwXczMCoX3TSPxC/oLqY252ds6HCnbI/nq9EIKboXI5BVdpYX/k/UUFkN+OZVHTMMorCLtuMHlqj3R0tY0IgC/uyo1CmafPS4ernPW9rK8HA2NESgolJNc4KTds7rWO49kDEHrdpq/ZaE4lPZa0cleqnKaJs5nN9OJzmbQrW/JOdRUzoPWeF00uf1iyN+SXJIH0HD/ya753fcIRYKzbLjNMhstKbQju8+PMoEtmye1vuDdCUEwoxCX847BaF1lKKkrW9pj7qKBAgIA/pjNo3PamsAEmD+wYybJGNxi/1SCkpxJYH0YcQBoMMo1cTrxckC/fDOSpw96tFaFjodFpq13btMWKgKbBm72gPnFLBMGO1lvh5Q3/HMrod4OG4+Tmi48IStLLV8mgtlQQVP6p1ijWVE53PBkGGjneqCSHd/Yu9OQeGLe8Lh7RrUxEzPDRqUwiBvupXIwX/ca/BDoeSYfdtQ1uFo4wwHcGdtE+NifclMHdztCWnfbIpNM6RJ9PFe4Og2gyI/TjtNc390C4n1xWMOtNZkomAHjqZ0FBsmiZ3izyNzK3aWFIB1x3U97F1Z5xpbM9xS0lhjIYASeiB3i9+QiCM3FfGTWPwAAKnwPoMYBKMBkhoe0Na3WslMAQgylhAuL4nxtRjBMMEItruyjfWFCWJrV962CKctokSSKEHNMLgtASn1IQ5wEJNfn0aGw/v2pGFBbs1xnqdI1hsE8wMh8qWm9SDr3s0QY+E7SSjjTpUePvzLEWlQqlwKi4k7uKzIAqpj7BooBbXT30Kd/Lfa6AfIX3f7iRsgo+urQqO9emEVu2e5XEstzMfb265jipAPMUSy73fB/HQZivhC+yBPN/OV5WAGW5AiTybFuKtASQV2MeeJZHW0YNaIryjRU2ul+LwgRAL6IHc5dk9RRZJwf1o/GL+GLUJdgaicFHVzSwAOTJTySqlY7MkACRe+/yic3WT1ew6SiBwasNNjnDT6uVDdfKHuvdCbU+x7TAwxpCXnbbXZ1r6JMzrIsFlMv4Hf2RILzTSBbvtgeFeC9+ZuO4U5akO3VDrPAbsIfJixL658dW90lqssffGu77nuJxGZICuK0+oWzvvsoQyYtxVUo/RER7Pay4JeGZMyQ64R6W35ONc0vd54XQHsQYAqhL7ZWf62fi6QK7TUFCf6+9Q6Y/LuiT0tF9z4QzFzrB/WY/3O9DKX37iQf3H5tTnOvRP1nYgADXknNgm02QdhqR7nEqN9Xh+S9+XPoM2AIN+DgCotAgq0DJpXkE6W0bCj4LJ94d7Xc59WwuhLtBLL90N890yI9ZXt1bw0XEuwlgmck+zkeLdxPA+WErn0ozZ4KtKEzEWKq8Bntpt1BM1kwdY2GzsfdsQbQnCTLW3x0GnLuqlKYn7RNDy7mak3ta9M+SDFyRPTqXm0pIN5xmu+SYXPtpCGY+B1ryc8npuu1sKXj+ld+H2qnXXxBLC+2s9yzGpQc3dGQL7Eci/7V30eKBXTztrG4iw4/hHxZYMPYVIwZ64Fz97KrXghF3m8FZD4AflnNw2vyEiS1Y6T0vgzNmfCXnQCekV4aaZIsQZ1YVZ6Q5QaoR5czU1luzmRDOOGGKs0lrvBNe3xDpXAgaIiiDZm08HirxptctnXxLYHM1TrcOt5WMb777rDMegPiisxlnpXPB3JwwmvLfmDMgIctSSFDSUkNmV8o0oikpdVcPWjhGlriVVA8VxdFno7uG9rtdcOeZmlu6hT+/urCNHgTK3df8O671hiFfgmXw8W7JTKUgVTmRwy1ke6YClbb1Nf1cjmXrHhOEKm6s1ZDmll7xHxtGMe5s1sIUuTV9BDSx9sAL5UsAgDU6xAAnmkNwJ7kSqHHSOHtD5Y/HZ6aAgCAmQIkS4CkDcVEm0oAed5+ph/NL2VHG9WwNU+gjEZArWpWNRgb4uIHDVeSJ9qTh1LyJZlvtpaytrUKi/4i/L6Wgv0ivylb69vwC+ynlhIHhfGOAqpPI2XPl+j3noDnZI7H4mvVQRlhJK3RvXLcW8xakR40NwirVBi/3g7kcGPlSBOVBYVDR+kGuWqrftihIIqyDUs3ksnplsEUWxNjqRWe6buWr0gGuK5PHHHKkjjW3//zgfcq703XPxAMFo+vDW+M6AlepL/abNqNRUhkKmIH1AyGmdFt+RfToQDAMwB+ieWJNRsCLBER4vp1SqIqk7kFGFcHL4mZB8a+Lh9HOZYOAcqovgzsZBRGzbNdo0LXvtDvjE+lD1Ar52TKuRl5EoOasC71NmG71/TQgMAGPZLUv0Q0YHgN4mUlmGcaSBQIJSPWLdE06c/tf/cC6UaR9BviBTu83bSZmgWCXO9qoEKl1vfb56rpoyOGoyeKs8P4h5C8tx37otFuR4g5dsB2OweGZ5VnxwZHGN88yVPghyX3qRE+aMapkhkYGHC+03wezTHb9tuFpRqQgA84KJ5TrhdryNx23mt5KGTrRfUwNmlQLIWXVM5QAB6pzXOXoAFyBNP+gRnVcjdYAABjeMzLSSVeFQMzfE4OV6o6d12QLzc34BjW6QOMSJ1dHo55Oo+yMaucPqnhdKUqs6hpNmoTaNo88QezsOZr8sp6Fv6MQyWhus8Wou0dmi7GwUBjJuTU+P7XHYELo23877uy55b9ZERDhvdOT31DazzzrK8PIlcrlVB4qTyBoNFTkyWZ34mHkaSeuyqujB+uCUgIEj8kJQS+nLiY5gr3G9l9NdClMy43XT20vgQ4eIrJ1TLthhF3QvM+a+bB9HoW/+oFMZuWk7ZG0Mae9jWihJggRGCPzPxIe9QQkRtLAF6JzRLbXCIAcD9c4fk9ooLGnLIAkM4A+hqptjQZrQFmRsn7Kunfap2RmyE5KbK9s1+FonHoKyXWoiJ0/k2EJlR0Fg21AIunNVugLsvnS7Oxq1FwuxcE0wd7dbpIOQ8k3M3b5RhpqSjDarTmI7SX6dHx6KWlBBufa+8EDlLzzWgv0ywi1VXMaYyslZ609nOFYPKgnvGFz5ta7jF2s8y4x/oioDfeMz5ECXRfXr9wG3V3N9vYQo3kcLlNwHveeEqVtBtkrNt3LaeLb+4wW9nNdTIujg4QcgSb3w0AHkrliEvdgh6SivPDf2xdGVAKG7YkYaYD43RaupTWngUe4ePAzP9++N3TjVg9x8VnX+rzH2kpOcu4B+U8vDgsuGTRtmu0a8eVlMgtqPcJgC+3NeAWLls5t/lh0EMBKq5CYPlcDkKGZgRoayN9/6E1AXodZi68mqGsL3a4VRJUHdYJCXQa09+dtcmJNOHNVIMNKiv2J9SKUQkoKkA0kCjFShLBbcVNOI1Ro7nBd2cKLofLXQ6jVKA4P43HVjH1ay1Z5UV8ZawaDsi/N1FdD2JTMpfhe9UteCu+sDitxZoOHlrlyEu2wZSk9ZwlpfsgylLvatg4sAozBdgmoO15aWmtEwscCmX4ZJq3xRvj6HQ+wXqxxG3PUna+7j+MxBNT289KDRAZp6Aspp0OiRWsKbUGYxHUbAhpTSfjvYLva6IoK7hkP5pShIfOPZ7k9bCzokvnA4rbCOgzjFsXtYnJqFOTIN5qEQIGd2/yTjfJbP66Eiuq0ZoHLXV5tZJ+caMEWYBcaySg0vap8v6BXOHyGTU11rIjwNuW3Kbwq1t7PmUYfrx8P9Gr38OgrHK0sqqwfoiXWBKNTtsMMNhQuZGHmEB/baVu5dk9psUSAP5ZtdCZAaaLMFd4nxKTeFkaYPf1BB3oDgCglx3zsjZJKYrAKE985GszFZFXwyfFA7oSW+7cVwFQ2uYplvWVEvlOVpBVknV9rFKhBGToxlj/r5A6sJqcTbR0Pf5j00QmXTV7A8h1Ci06fgr0MKrQX3a4pgTbF2UvSJ3m1I+x5ioais7k3mYzBP405JJVr//7N7LeMqWzouu7GDB9H0VlebiWxzreTaLpRZEqFWZDAVj2DoVl8uUbqcDH70aGJ9pwz0By7M/LpI8uFCdSeJJBzz7FwoHQcm5SEr6fyN2kHptXAihYB8sCvqlViTMDBgDrF7h+7kwLrHiqSkIgPCuAmvgVoypZAU+8GrF2ry3IaS27EdUnXBVDMUhMFPReW4TRkxbNtqjXCElEjn/J/zU55rRA8JKXUjSkZ5vRaAuUhg39UW2wDRkrCTKkHJkGeqWJd1pDnELoNK4ucpOVIxcGSjnpXmUFqNOK5PbL05NmBEbw0whDJoaLXA33uWgfx5dDmQ7+voK0EQEHjEPYBsEz2wVayjQJNh7LNPGHd2L/RiglB2drkKZoELKaS9rAEh3hpz2gSG+wd0XRpn5XDUYZPQGy7RsW0AC+mbXANluhBFIH9h8AAJ6rRkLPAGYA4caX5ZioqABYwxDg8NlH7t/nI5CC7omNHwj6ei6ZrERzglJvGxDUfVnCqinygVAtaV/rWrzMf0+1rqvM2GLzUt0I3NI4oFoSwBsvoznC+RFEUnwzSf50zGczt2M7hzAQE5Q/Abaglqtg9crd/Hc6TePInMGXO+RfSWJjhzJMwrU3/a0qNG0plnL/4N4puwAD7hBoLrqDkRB+14o7yEkh+VP4jtUJRAyDEWJ6hfj7XYQxXWPuLJ85y2KGR+lJWAWkuN/SrypdXS6VWjokUIEOT2dnUwAAwCIBAAAAAACxXLINBQAAAHwCJ7IT6ePo5OHi597c2+zr29Xa19jZ0x66JeCZrTrIC0NKwwfzJGoMAQlnC8yS3uhgGq4afZ1USDpgZZ5rd4fOs3xBbdhqyE1MK46uI+usZYSNPDqaILU8HhdBq/As5HfE+VfjBrgLaxszvd//UmVrBQumHTDsZulU79vpRfW0HNgGw0DS/4SZ3zGEbb7OSaeO4S8p+ZBXl4psUDhsXGP6scZVQVST1gnQQXmMIpmWupFW/UMlXkSa3JD9vw1MsgufSzqfX0O0CcWZ1GX1KsWqYzl4QULiOttvqENQ1hK8j07mKLnCyz/G0rqJ7ReWLrkOYQq+UOKzbL3axD/JoQkAXspV3KW9dEMxcEKsH/Q/wBNQoqtCJ2zpwSQDECvRcskhBvSC4Sp7XSc3JWvIPdE0/9h61GJ3w4vuI6pN29knOVbxDak4FdcEVEfIsjUOAqc4I8j4Xx2ZkJEGpxbgAmwhxXtY495iwAFoKEyY56yREM1vkt8NtyU5RtDE6ltxQNKpAZQ9ASwS+67kb5hKHJs90VviQIcHLdil0ozFQpCO3UmUbVV9qktzfP9kv9MtQs+XveVufKph2RugCTDRfRU2DY221kozdMwsfkeMcHNfb5cvmM2v53aYAfj77VlqsPPKlAA+qlXlNkMomMDeL9l/azzoGQBgWQCZDkjHNmrPlz0GGhpqcZr/xe2cXt+dyE/ThnckJPxjpXxxEULsLs6/OQVQPCZD04e9hAdrfy2l7bgot0yoPk0zad2oNWaNJw6D18vL9n/g9Jd4UYCYUKH5Djv6DooLLbpAVER8dV1O6ZhKHYyeVodIy45KjCSitaQUUISW+L7mFfuhwxiDSbYe5edR09Dv/dLJBGTlwwfj13qw/ODCmTsz72/KuD06fYWbQQo2sqYm2YocSoqElyRCCARjL+Y4JWIvtknleAcljCOvZ4edrTaxjTABXqol9J5NBGigMP0BAOZEVMU2bAWwYcK09aOWkhKJdAB4ByxgBVOGwxs/iGSl0SpCuo3UPo3yyjNd2E8W6M1NRz1VGTo5F5V3bV/Q5ijaNXFvKjWZOPSGIxdck9G+HFkT8NZ7L0he66RCghuJqABGOxJL1SFsBZpMRsHVkqro1qh3/DXmFvkVibHmX1hiMs1k2wGF96dUia71LcCYZkDmTWgxm40a+fLVO0fCD6H4MffCWryjtbmlXAQrim2C4LW0fnM1dUaPfZ8DTTshill9xxU5LRUj7xnZg0er5ORZ48RzIFsBforlxTV5M1owUGH9wL9fBxLuWroqzDD2gqptEuMbrYDHWln8nlmM1rBfA3HGnq4MLdWNoBZNkv3TsSRErtaMM0mSfaAaAmH1uXYC3lc6L/icWmjk6lkbaXg1p0oq4ml4/IU3ZRSo/56bLDTCtkeNZuAf9j5OzKhJwq3tPBBhNlbKMlErHSLSicOfNKTmPiJMkHXnnU2BvjVfozVcdJCeqTRdGetRDz+ZVZuVzPsNk2eW71pXqkThLELcCpBpXxx0W4dpZiNZuvgJyzbAAsqKCvv7kWPWgaEJB72xbLF6sAYB/nnl8dlclmLSweH+AABkfhXaUXIsPzFyYizQ8CaxAv67e629ujffgl/YG26mKT1ml3I4eZ7NHR0Zl0TZrZLx1Rwp6Zk3W/e5V5RM5+xIdRGbjdzPARcupp8pp+Ts+TpKes7V+0gZHml5uU3fdVRR2wDpNmjB8MAhh1KMGXoXkcz+bIUuLojnIfvt3Tw+Hxv7HfmgY6QCD4vijmV66Ynp8mu0GbytKL0DTNvdZJZ/iKw0JkVE6+QytdNC2BKzpikfG/ED3cqSlpoWcup7EPBpy3XtBGvTZoflplPT/UYDtPu4AD56BXjP1g00kFh/AABaLNZgOvaqk6VkuTzpAAvPJAJyJ1/unKVcbn4eSa61+Wq6pc3rW2pxoweeG5TlDcoXmNFxg3avmGMthaLLao5GlrCmh+/vrZsNkqw+yPBtUvcJcS6KnUlNNkMdnsu8joll1fPBtsewvdy5tvSiryH0jTDqM8yZtNqn956x7UBBZHsPiIm6PDIMikzfVUpbVaQJ4lBzsJrS9Sdtcu8JjL4t+eWj7M4yMEZQt1nEhcZiKQwNuaud+WEzHIZEfU3hlxni5fntl76ESSPkpZ1qQm9A0L4f8+9GKw1yDN555eGZbRiYwP7AxNXUKMGobUuAbtYA4bY1cnQJKR1wt9TFHtPjKSa8FcxqZd9buqlJ8lMXkldu10rxocEGZUYnKoHWI7qT3L2kCGvAeImOSPYfpU00ctOGuwkEp2UT5gXRq4J0JnY0HMfvWAyBCvdRjqRZJMDO0/sFhrWeiO9IMOXPmGN6QdKxJ8MOGEj8cqk2R2s6r37dDHNIDJjNRA+j36hJkmtrGaTdht4HEz27Omug8CVb07iYv84apf9jpUeJE/Jw/SK6d7HoZRmUZUkPD/NvgrqzW/o7IdzWAj56JeGZIQQUTNw/AIBXegYBY5sBqDZqPzpLOABeZwhYMYqMxpfTuwHrTSnHSohnw8y3PvTSIltjB0jrqZdW/+4smlWkylG6/qES3JANSN79YMRF1YkHSDAvRcaqLRu6vPP8CdzosKkjtoDIdWTd5hbpS0vA+bt0QQJLJtH6M9a2ARE59fLCjdVjkEqtSmaHkOXzRe7GxdWrlK69Yyr9lbMZCokaCRB/RCOWRXBBIoiCw1uSEiiR1Ju6nC2RBOmLZu9W9X0QigdEwfba0a97F7vmSud92YIL5uUIWQO+iVWJM0MpAOw/AIAosyWAFaCVPCbRybKRpQNg/VyESOQMhs/vjdWkpM4sJcdpl4+WptKbawxm7s+2QqYaun0T15ej0zFr+D7ad0EGbgZ6kLpWALUc56chXKBArJVXc3iSPC3/N9jwi+ZG8Jg9MmY3MaAZKF0XMZC6n9G5F0z3y/IUB/AFDc5uUjX/tpBlfvdGCrJR2sGX+s5316+ck1+4Tchln2I4rKb0ZUHaCdpnCL1prNtYAfmk/hhIeSNhFLBzcpX1Z+l/ku2SBWm50YwqvsO8iOwopRkXbAO+iVXxZdq4IWhIILH+AQB8nFkAWAkwGWigolyy9o10AHhTCjYYh5ynmzIeYIqm/lAraqzcw4mA0FWZFgnnfAhNekJzEbUstEVFzox4VGJP4y9bsd239tp+nhEtODcCQ/I58o+CxW7A/sXRkg3KlF3Ma+34WN6mI5BmD71G2ScWywOqkpOwPeFrO0UOOta6waQrMfq1xIhBFK6WpOvWIf7oukHCv9J0QoFCgetLHNKsFfUxREiDDlGySwnqEUNqcMl6OsAXW3z7HAJCFyK1hT+ZEVtKRAtE3fupaS6Exr9GPgthf2HcUc0yHrSWAP55VeQ2WRmZgDXrLwAAAMBGA5kAhMcSUfYqSgeA1+OCEdZEEoBGjFMNCFPRiWba0SE4Di5IW90yoLGnqeNhRees6PqtTynF9YkzRxb2TGfbHYJgk/gJV2pFWDqLDtjczDcQER6frh12ppE/V7O9819m0uttj427PYu3y1YV8l4TycpoN0y8iLzamfo5Je+SOiAL9kiW83HXS7mw/eCc1DBns1riYN1D806mxK10e03H8IRLb6uFQe232RXD4YRUP3iI6vmdNhl+71CxuBw9XQTqaqNqZHyr5OTGUoOtN6I9Kq4rHDD0hmcBJgp+ekXwTFaOgArzJ7CTADrYCgAw7cJdk4S0q5QCywcSH1j4K+jLPrZU45eMuBK1XtDcUB80IhNppXLBvFa2cvzgBmQu6yRsuMPkVSKVOmJq6UWKPPnWKjla8UA1dx+tCyebMm57rzj2UKwF2YEg+C6RhxYHQLFomgURG7VNUeJKiRKpOcxOS1eWK++MVURM3s3dJy+xy+qTCpAUMu2M2GosLC76Ypa+TUWbiuCltxdwwUThi2YJOCWldbvw9MiiVoNhFIgb+MA4l3siHau+xDPvQ7CPtpom4Ks6BgDeWqXojA2lArhPoqcrG0EVGKuqSrukigKatEbmGRUOCV5fz/mmUwf00oH/fT1cyfTNeTLQaRNPke3QU4QJ9Mmh5ShIyJ/00QVDfKgu37Z5v0MimeDaRg9Fz6sTcK4GN/6FvB3LwNXOwiYHi+mMN90/SeBVwTtgLiy/Ll0iEus+MN/YnUT3y9QgYL2Lj+JBVhLT6poBS8iYQ9xC4WyBGtq1fnXHrp0mCAx2FpQUttLKZUjc9vXycuPUeQAgvewTCyWmw6gNtlDWSn+TJml6UeCMFtonRwDeeoXEOZPhoADrFTcUqAG9sF+t7Dy/WumA773D/cJ47Hq+wbc+LdeTM8n7U8OjLdxsshVzVZOuynqE8mZHpHk5uiRu3i1A8KdGqk7UO/gluv8lM+GZo2saxUVktcDjJaUIzbQ5LdnHn2uXvsczqgUM1fZCR6hReIAR0LP/upIiUWECBgob5TI7Pr86CU3pua7IPoxEhnvmKdHSgfVTw6eHuFh6jrPL8XjfiyYKUzxuOeCE3IVExrJ3z7wb2qMBflj20NLmFscVM4zI8fBDf5mgSQlXIvCvA7MCAD5rpXQbSkEqzLyvoctNQjfKBYBpVVWMRE/WFPiYa7KVUB8UdNeM6dv36lth9yF90N16TpdhKMqj2vYqt5qPnUThN5RgcmfirSlPWVCggLFw84/vWKakdITHikpE+DCWOKVTo0QU4IclptP+otLQBPf2oMB9Yf2DZXxxruoPhWtAr5XBgFrBUoLI4ql35lgweYgD58reGs5hTr7pgi4q1yQRo/t5HhZ9h4OnKxyRQsYVRLW5ds1RVGN/qEpOk7nY8xODXkrrchTHB6Cy5yF846BbiFtTGBsDvoql/BnEgqIDjw8cJ2gwCCwBKik/cdYz4SwCsdMGuju0/RRJ4x8/3xU5cL5lUC5Oh7QPDCFmgvj6gyi91qtG19d/MMOlUwksXWaFu1wYOU03OHdPxLD1rqY+KfIZKlmaU3m4eb5VJ2IwIfrBSr2Y5dBWoXoMhfIxxhQvSc2kuj9guCO0ENJdJBepkAAQIP/YqsdRtSshRFRLqPrzVVqQUlVaygL9GKu22QpOXIzbGrUmwNyCYbruSeSxwcrZGJKN7tbHG0OrF0fKbPoD3tpF+w4AOgoAAAAAvnoF+AweoGBh/STxlJJVsqZAANO2/JhEYuWLAg2Orb1EG+/D2GD5PY4ultfR7SwrHBCdkaxHd1MmeX4KIFJz6oIOmBpDD9RTZ9UQPdbI0VVPyRZkqhy4LUrf94gzkcA1IaRHmc0dF4SEUi1TiE5fDntEfyN8nHUvDGvafRXswk/CzraO4sAYiuCVJle+rfF+zix9/9OLEGLuuwMXTlBkF87Owywh0nLsnqcLQCRCR89q/woMXWZKDHzmzPfRx7B7ojjORei530UgA97SbCQyTmaVOJi6Tu4cAT6aVcgztAANJOZP4++XAp1wN7IhwdSvTnbO07JPgesvjL4zhTa37Ls6b8mtv+t9rasVjBLjAtogHogl7cKqNLC5LA44sGRjmzUsw3yYKvJy85OJGn7CXa8sn+sgBpVahYNNWzvsRDtXmae34r00KHqJ2PcEkEPUE2CcxSCGkmzu2eZf8RbefnJR8NyB0RHJ9DBQhZw8Cl1LqdwfkfAx4P29OOFrmMlRxktaaWtVGALE0RKcXcNtMpYgp3nwSnE7mdXgW/2+Xd8eF7yJr0kCmuHaHQlPZ2dTAADAbQEAAAAAALFcsg0GAAAAG2SN/hjf29zf5N7k3N7a3tni3eDcKCctKTEy1dz+qVX4bSDBBIY/AADfCzbApE39Ki9WLOmAhq4RWIIjQmQn5OTvtI0lsftq88lMlB42eO3Z0bW3Tw9WdRhRw17Sq3eHbdOvUElRiS4KfhEUUKc98McmXVGwysgyZzPJTAAOn6pcCCnGxOnproeCCk2eBeU/CvKNCuI9BVm6TM8Tgwn7T3/p9YaIAgsJJvtbMzDK6HBkKhAjvoWsTcqbOn6y48kZInvvWtBtV5LZGYSMKkvV1jC/JKz9K4CLVH+YrpcHGYCV0WjEAfPEsPvEgmgFqLCbkLZ4W1JaAmYv/0YAHprl4Rk0wACmrxP/+h+yNEZ8SmxvgDYtqXkA3zNJJdIBUZxjd6UX1rvE5EqvOvDNf9+1pmL3oy0kjpaJl4QqmUuBKL1R/i2xEB9uD5Dvz6l3Ez05Owul2Y0XdmYy8ubv4K5VGrHe7kjiakz5WyEqwxWNsVZSLAp4OwNrcOLo6p2qOsnvVWMgB57p1vCO/4i0C4RdArKopeSY9K8vuD1xX2peR7oQPCJbcRCi449vLIPFkdYanRbMcJXd9+6y7Q5pTtnBlDOhXau2vLqXTASmjXWA7qLTCj9HnS0AHprllTN0A4D5DwDAFQEahKvSKmdkryjQoApAqdZsa7+dmMR85RGlYh4tkZAEqvefpyay/vhtXt2q7cCia8Fe9AqNG6vJRmNtOk/EJlh7uwde7dD+nwFF723zctT7qzirCSHe9G2XuuLeeyQtZjbRijrrAaHl9VEqrTYQKpGkeUWZhMc+AFvhBhr+2Mck0+ev4oXqKWh0ctt6P97tnCVTMolm0i4FGBtlBjBpC1ntbinj/61iJY7pKlQKLfBN6Cann+OO8mbdXfSFJm8Iy266VkOksNZ6VsAT47dBAB6q5cltwAFg+hq+/z1oA/JWNAA2gLT8Kt+vKGcReB327rDJSBO47uKKNnVFE7KSSwzEnDtlQlSVnuyRTEpXZmobjoEPWhBQdBcQ3asVAewV65jo0lMk2L3uS0uiq9MYF3b7Tk7nGEg4iwjlhrjDJPHyCyIhTzae6TciKUX4ZNP86VltvkfM781brJbAbupQyD79IzaeVX31uOA9uUISU8eX0hnHGa7SZ0bgqMzjtkg5Ez6i8xa576wtveqE95OgJEjvYv9r6ArIdk+xvvCBul/528oOhx71V0oUgQESxwMeulXRGSoAYPoDAIh+nhqA7QHhXlWbGD/xKQD6swsJZfRpZvgijlxiLPiQhGzb2U8rY5DSROyn1rxYWZafTTCmo4iSfbpJoXZq4TMDDJnWlgS4L032ROaNM7WPdVyMEXF8QIVbJo+0hPUTlrA/38eyLI/z7BVpXjLObxN2stoIPyyWidA2RFCZyq6VID9rjGD0kQRmGFWXFlp+j0hmYRoyoQ5Wb/ErGbd6Q89VsheJdoSbZmhXX88ByflbQpfLAkoigCqcAzhsBEcYX2ZSM96ytGVHW3obln6xqFaoXugdqsTkEwk+urXQNnlLUIDhDwCglRsApG3ql1wu+rJ0ANjuAiuTej1i9BkZaWxEWHeUiBr5otSNGquW+XrzJtq810jFCO3JcO28OdA6fERfHYoWyOuqcsIUdaryi3ZgOj0nSN85Clsr/iPc0CD6Us9+1T8NL72uK7MmcZXyLLJ5KGARok1Ew3hAD42dXCci4wdCr9lFyRf3569BCSTuJGY3meJdlCf7mhRwv4YsDFzXuwBDpWSb4sM7T9IRZhLTXkUpnsBStF7f60zxXSZT4UDVOXpfZgflUjzDHrUMycWtm+C8cAD+uQ2US6gEA5j+AACsJxvAWBVO/MTFpKQDwKBcYLasNUCYbfkRp9x3Bd3F186fFYWXNITWaOvvazu7ufGlmnp78sUNZchRRtpbGVl+wLnh5hWnGy2JcSZBgkVS8O5/65Fs7Du2539o4dEWffB4Nu67gsTaWeso/SXfiJma99iJJw43oH6+q2lrSltHbO9YN5CfMjBbN9nwiOgbms7iF4IKaNcjotGt7b+jnKiJKqJ+tD9kqcv9ryUtW4+8GVDDtLjSy0vp25CSOdujn3wC0RPAexISt3DESxXw4aY3LvJMB0vcywAeurW4MxsNZJDC9CBu/6QVoLQJxuqlFWW/5KJAR8Pxi7en6z3lvvi2FJS/t+/P/GMkV3X4NEVE6XFbcDLDO7RN6cM8nouoDc73JEFa4yLTkMYYKvfgIvEZfLHQvdZRr6BVsfUkVw4dcwKpcTdls6afXvipwTpZJlHgu16ut0NMGEU4bCSOfbNAFEf0g3zyNzdG/MZkyqYnpYK8owsKauqtgNOQR8u8S6+QVj2Mz4rUw26b8HAOZlKwHrQUFLoQvRbgoe6wEChDvLoJi5haaE7YvLG9nmF7x59ljx0EvrkNg21wAw0z8x8AQNPlAlgP0I3VxGg8bQgHoNfzToDZ14cuBPHUNdipD69YXxun4kAgNJWYEhprGPGr8qJNS3bXWrW6u9dAIHXwza6kNPPJW4sg2XXqWiLXJ7qngtno/QSQZM0lroYuJGJvSJn+BSNKfBEGaEZbhgxHjMTk7iHPnfhL1XPXs1y4L8L4XcCcg3yiWGypZa+el4HBLRfZwCapipaw5G5yyu8YgtkLkSNaI82LYlFxfSZbYQcNd5NdQW1yGO7E7k9ee4/n6IXWuJSQhwEcc+La9Sm+NhkAfrm1w2WmBC4NmP8AAEJEpQSYtlVSTlfIlykA+pqVgGNZcndjitJmD0xZEXaorTH75ONOXs3fPcylW8tEkTK4sleTXcGrA2hwulAJJluhJloWvsMOvccaaJdHBV88+ofSjY0GrXWQkqKZf0oi/szTwrzhBd4wRWFXVF93DBMQ9XzHjeHqJiglXeHwC7FsNeKiS6sslNTXlKDElCjOocpu9CZDXceIRLZmXavvmaQCunAxFyrdP5/36Yj9rdo8hqFBT0QGhCoP4veK7G7boe0QfNug6M3o1+p7jAbeuVXtPUkYANr+AQCYxmB9QLiqotHaJzIAsgpycchud/bjwf30ym66iVXnme8tSDLGZHNk9Og222He/deGozzqiGswLt/a2E5vQRwIFqrozyVKiG/3N4kSeO1C0wgLHA3u65PJy5+KbOdItsfvbDsBfT9D/fQV830+yjVljHVzYHceJ0u6TjfNo3B3ATgrFx0nMXKBKOda8s2Nr7LwdFWlNqYfVa5boQatSME4ndnnRrBRJfStUMTdkj2KlBHyR70xx1XqPuwGlrCth3wpa/oiDw7p7osEVrnP10aGAwB+uc1nt6EHmMD8AwDABCtApVWVGJc4CgAHF4Dft2bft/34QM2Y0x+LdV777ReSLi5Beo34uhJ/0R/xzpIvPS+mn0Y4yYlzp8nZil0lu8ruoLtrwEXRNGp8uwMfzzOLKja2MOIBEaOzfn2fPmAhldP+p2cHCxxvJCsoaCuOFBY6/xZWk2+6SJtjHUTQIy+Xd5IkeoYbk9ExKmAmK3G4GPQKTaJXXr/tJdBom+S089prbYHx2TrHyzhabNNkJZCXo8MijBZMTScz22i91C9AHeVWgSCmMxnMW28nXsnNWPt81AIJGH4AAPqcYKyxrVLlAkU4APqt1cAX2+1nLWdvKb4OU2tfzNPS5JiY+Pccn3ydqhr5+JCSJ5UBZFp080ZdgiGg0dt6vAilb5JJH/6XsP6Eoqq5r81o35FsV5lJAJk1r+Tvxj3n5Jwk0n6RIhPkTL76IrMtrMfoVZiVbAz1BCMfKZ9Ev7qcb/v0Hp+syfctKV5aQL0VY8YJCEFFtZeruTPozrtVk6Rddo1EzQErPG4Vxh0G265qKUL7Xkei4/s6NbUiFu8ZqGcAL/8LQ5dotv1OZSByLAyUfMmSAf65tfkzgzvYwPoDAGAWsAFU6pcfnTZOOgDW5S6yAb92wea/9Pyr8jGxyOL1cMjhqhI7fW2OPQ7puHWkM0Xjt3xd45erjqOKvR84vKx4yYMcpERmtHh97aguEav9gorUtPMTJjdiJq0dpAT8cf5yNSCRStofMhHZKdArCG+Cy71Z/TCZyJRWLap2hW1JuzZDyfrd1uzjnWGUdWDVehsQOpGILo8gqFPPbXVaZfkuE3awZawS3rBE9qRqlrh0u8wx2kfleRCej+Lq5KjcD8hoKx4G22cNhz3vqFJTKGUAnpkNg3OS5SAQCtY/AMCAKxfAmLZpOV82iSwdAC5lKwFH8pb9zGiMZY3IxDm9dsbzZNWBdqsKvxmqZ5G3KKevLqo5DDeonT0rwy+CGm6h9wNzMtkwOr3AQi4h4dWW/OjjWbBw5U5esOKqAEVmmadfCn+RP7JTJdNeSn0l+C6mUkn/lgBtQKmgXNVuxsnbV2n9A0KSfZTG6ky6IdBxyendhX4dyuQ4C3vGdyMojlReM9hDGxI1jIzfm1R0DJgpU24gS2dKxv1xeS+bWi/dXUHyf2sRapgBZ2+q1ZNO52BK8Qx2SQ35bXJ3MEXI0u/PkTtc1VTkKWMzVzYw9qqNpZUjSzpgZ8H8en7ceJ470DS8Ft/atOzN4k7urjWbT3xt7ipKETszPwg8OGMfLUJ/5PEG9Bqfo7m0zF3qpbGzEQMJ/aCf2giSNOOuf6/pEmc5EwSUwnNvl17h/Kyi+FjeS0bb4osHwUXXnFaHu6gttKdOaxOC1KFkCe4NJRUVUOPosibsPKsa9ttp1dWZGKOkxVsclH1/dJ4mmmZbPgtuEtjl9CGVruSBepuvpLu/y5DcKScFT5Mr0ZKfqvV4LgAAxFr1L6DCKPTwnB8NRJRDflRDEkiwl2NLN7dVQwC8U/gG47FNnzt+EJxOdcOGSz0oCT9/NTAGhPYrx5dE/RRRjBwJ+8fBzjylXwS+Ifl/Awwurzs8bCWNUyhzvwGEkIbyBcQr9JNFCUX82ZP3u75vcqlWihnk8t2pptAbAFwmi7pHUaqZm/m5WYBT8fj3voKuyMJFfY/J9tH+ssd3T3MoKZfrq1UAXBK93dgcONhvCaQr6sG1pprOiIpzzeovdxvCxQmRu2Zt1qJ0pip+LcENio/tW7wDANTtys3242FDaVrfliCtYta760ybZ3nKS+2yC8gUgbIX19x348nurr7jNPm0qcVY1iQAeugc5E8Y/QGpMdP8AwDwJmjLSEWttRaagV9zRFSte94ssDe1d3GDzJYZl9ktFLfdcStheTTz0euB9zxqHPoS1Z73z47v4JpNvfZnIUKB4CA3FWU+UsLgh9yCN4sdPLh0uz6+QPjW+mCFXQjsMkpR5PQ1lJX+cwZkqlmQeyMHpJ+8kYXW0QNdTLYRhZ910fP+1kss5NwcUj7Tn5lXOBp4u5Xl0w4SaoEvpVt807mGFckPLLZ2Yfe7uoxW0L0rl/Ane/P9/y0+PAao95VVLnP8ZTDoMO4SnqkkiJVRN50dfb8Ibt+usY2NFMDY50dtojZaBLKIO8lMoy7p7gubrPk42G7Ti1+vnjKTD+YSO7mWbU0UWBc1syWjMLNJTqtGlQNBYa8Kea1RWEYwv8QageE8q7zxdT1rxt0JC0HyK9F5w2z6NEN8Vhyvif/jB24r2K9+8uQO3jC+yrLDw59qG63gcetuRIqj/ZyDvRXFUv24NBpGJCcCcblsO8HdICPUgx8chYMsp6/CYVd5M+lRJYMFFDy5TZ5en71VS5voEVqRW9RFiJDK3sgO/AiaAQDgPwAAAE9nZ1MABAB6AQAAAAAAsVyyDQcAAAB7LzKOBNbb4Y4+mtRxBi4nuH9Y9fbtbWMLIFC3vKHKLy2X1koHANPQ7FXZvJKSuUwQS2nb9tWBZn3/51M8DZQvhB0JThskl/y26Ir7e+NNmbgjqlDF1bU/NNIkd0S55AiAzkll6BVxz+J7FrF4pmKdNqUx6yl5YqY+K51FGukyFPN53PUxuohwwT1Hq3w9qP4xC49PssGnEMSsT9bUoxm7geUFELj4OQ4RI1ei+5Qv31EqDyWZDUIWh3QotDjn/fRP6GXeEx8sVJZ0JFNbFmPAUl8moVlXb6EcpD8FQDUAnnk0LgGbDsaTrbffXhGBgGzMXsA4A/DLyRWd1lkEYveTRGmMzYjTnTehKiY+ZP9/3JhPTQ+rDTMRTCErTgSws0oxx7+DNSG1k4Y71VX51l6EQwFVgJ0l3Nlm73RlhgueQr2QfwxalTaxax0cVramruI4Ku6LwcCc3oebn12JVc/byG9n+6dXud80nuzrdKEbKmdDCpDOITVqSvaVQqgJ3OMd6scSUheIJIEVWooRoinCVJusmxXg+n61cyToAnxD9AO5+Id59Fruyz19H5WRaiAtn5QBe47guxQAvmikpgPpNnFOtDjV0O2NZwBDAjrGSsYKl6zJcBaBbcXgqOe1r9glK+bgx/wicTjqsysfn19vWY/Tpyh4bUDtFsKYlpHIzJFCUe4VR9fK+F8+IqtQfPBPFHHLyhd/otajvpoh8tl+c7bNhj1s5I0wZ7xX4e9qxkr7DVgEqnz4tBO1Uy8GqkVhGWSrfw2Ei2gCvGbndRFgK+DyIiihFmNQliszLXt6bK4UJrho8fDyTceQthxlHtGBJAxu3JSsslDsPB/gciqVMr97WUeUyFd5CSi9YpxlnGeIeY3WGo00+P8KHmb82U6VC/XE/bexNvbZKQAwhnWIQFMCAACq8GbUmXQm7VF3vHqwPLw7V6X6q1/+fD9XserjH8+7nkIZL/d5m1ogRViePT11VEQ0e+sDOxxd80pHFGZellqKcB9ddE7NIy2Nj/14Mj8OrOP48VWXLh0ng2jWf7EYA8xYbwN5iCjKG2Xb8+OIopamDQAQAA==","base64");

  var audioFiles = {
    cow: createAudioFromBlob(new Blob([defaultAudio], { type: 'audio/ogg' }))
  };

  function createAudioFromBlob(blob) {
    var audio = document.createElement('audio');

    audio.src = URL.createObjectURL(blob);

    return audio;
  }

  function handleMutations(records) {
    var addedNodes = flatten(records.map(pluck('addedNodes')));
    if (addedNodes.length > 0) {
      audioFiles.cow.play();
    }
  }

  observer.observe(target, extend({
    attributes: false,
    childList: true,
    characterData: false
  }, opts));

  return stop;
};

}).call(this,require("buffer").Buffer)
},{"buffer":1,"cog/extend":6,"flatten-list":7,"whisk/pluck":8}],6:[function(require,module,exports){
/* jshint node: true */
'use strict';

/**
## cog/extend

```js
var extend = require('cog/extend');
```

### extend(target, *)

Shallow copy object properties from the supplied source objects (*) into
the target object, returning the target object once completed:

```js
extend({ a: 1, b: 2 }, { c: 3 }, { d: 4 }, { b: 5 }));
```

See an example on [requirebin](http://requirebin.com/?gist=6079475).
**/
module.exports = function(target) {
  [].slice.call(arguments, 1).forEach(function(source) {
    if (! source) {
      return;
    }

    for (var prop in source) {
      target[prop] = source[prop];
    }
  });

  return target;
};
},{}],7:[function(require,module,exports){
var isList;
if (typeof window !== 'undefined') {
    // Running in a browser
    isList = (function(window, Node) {
        return function(value) {
            return (
                value &&
                typeof value === 'object' &&
                typeof value.length === 'number' &&
                !(value instanceof Node) &&
                value !== window);
        }
    })(window, window.Node);
} else {
    // Running in non-browser environment
    isList = function(value) {
        return (
            value &&
            typeof value === 'object' &&
            typeof value.length === 'number');
    };
}


function add(array, value) {
    if (isList(value)) {
        for (var i = 0; i < value.length; i++) {
            add(array, value[i]);
        }
    } else {
        array.push(value);
    }
}

function flatten(value) {
    var items = [];
    add(items, value);
    return items;
}

module.exports = flatten;

},{}],8:[function(require,module,exports){
/**
  ## pluck

  Extract targeted properties from a source object. When a single property
  value is requested, then just that value is returned.

  In the case where multiple properties are requested (in a varargs calling
  style) a new object will be created with the requested properties copied
  across.

  __NOTE:__ In the second form extraction of nested properties is
  not supported.

  <<< examples/pluck.js

**/
module.exports = function() {
  var fields = [];

  function extractor(parts, maxIdx) {
    return function(item) {
      var partIdx = 0;
      var val = item;

      do {
        val = val && val[parts[partIdx++]];
      } while (val && partIdx <= maxIdx);

      return val;
    };
  }

  [].slice.call(arguments).forEach(function(path) {
    var parts = typeof path == 'number' ? [ path ] : (path || '').split('.');

    fields[fields.length] = {
      name: parts[0],
      parts: parts,
      maxIdx: parts.length - 1
    };
  });

  if (fields.length <= 1) {
    return extractor(fields[0].parts, fields[0].maxIdx);
  }
  else {
    return function(item) {
      var data = {};

      for (var ii = 0, len = fields.length; ii < len; ii++) {
        data[fields[ii].name] = extractor([fields[ii].parts[0]], 0)(item);
      }

      return data;
    };
  }
};
},{}]},{},[5])(5)
});