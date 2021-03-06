const dataset = require('./dataset.json')
const unidecode = require('unidecode-plus')
const mergeimg = require('merge-img')
const symbols = '!?"()@&*[]<>{}.,:;-\'~`$#%+\\/|_^='
const alphanum =
    'qwertyuiopasdfghjklzxcvbnm1234567890QWERTYUIOPASDFGHJKLZXCVBNM'
const supportedoutputtypes = ['jpeg/buf', 'png/buf', 'jpeg/b64', 'png/b64']
const Pdfkit = require('pdfkit')
const randint = function (n) {
  return Math.floor(Math.random() * n)
}
const getbatchsize = function () {
  let batchsize = 10
  for (let i = 0; i < 177; i += 1) {
    if (randint(8) === 2) {
      batchsize += 1
    }
  }
  return batchsize
}
const cleantext = function (rawtext) {
  return unidecode(rawtext.replace('\t', '    '), {
    german: true,
    smartSpacing: true
  }).trim()
}
const getbufferasync = function (image, outputtype) {
  return new Promise((resolve, reject) => {
    image.getBuffer(`image/${outputtype}`, (err, buf) => {
      if (err) {
        reject(err)
      } else {
        resolve(buf)
      }
    })
  })
}
const getbas64async = function (image, outputtype) {
  return new Promise((resolve, reject) => {
    image.getBase64(`image/${outputtype}`, (err, buf) => {
      if (err) {
        reject(err)
      } else {
        resolve(buf)
      }
    })
  })
}
const getwidth = function (paragraph, batchsize) {
  let width = batchsize
  for (let i = 0; i < paragraph.length; i += 1) {
    if (width < paragraph[i].length) {
      width = paragraph[i].length
    }
  }
  return width
}
const generatepdf = function (imgarr) {
  const doc = new Pdfkit({
    size: [2480, 3508],
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
    }
  })
  for (let i = 0; i < imgarr.length; i += 1) {
    doc.image(imgarr[i], 50, 50)
    if (i !== imgarr.length - 1) {
      doc.addPage()
    }
  }
  doc.end()
  return doc
}
const createbatches = function (k, batchsize) {
  return new Array(Math.ceil(k.length / batchsize)).fill().map((_) => k
    .splice(0, batchsize))
}
const getimages = async function (result, outputtype, type) {
  const imgarr = []
  for (let i = 0; i < result.length; i += 1) {
    const image = (await mergeimg(result[i], {
      direction: true
    })).resize(2380, 3408)
    imgarr.push(await type(image, outputtype))
  }
  return imgarr
}
const checkargtype = function (rawtext, optionalargs) {
  if (typeof (optionalargs) !== 'object') {
    return false
  } else if (typeof (rawtext) !== 'string') {
    return false
  } else if (typeof (optionalargs.outputtype) !== 'string' && typeof (
    optionalargs.outputtype) !== 'undefined') {
    return false
  } else if (typeof (optionalargs.ruled) !== 'boolean' && typeof (
    optionalargs.ruled) !== 'undefined') {
    return false
  } else if (typeof (optionalargs.ruled) === 'boolean' && typeof (
    optionalargs.outputtype) === 'string' && Object.keys(
    optionalargs).length !== 2) {
    return false
  } else if (typeof (optionalargs.ruled) === 'boolean' && typeof (
    optionalargs.outputtype) === 'undefined' && Object.keys(
    optionalargs).length !== 1) {
    return false
  } else if (typeof (optionalargs.ruled) === 'undefined' && typeof (
    optionalargs.outputtype) === 'string' && Object.keys(
    optionalargs).length !== 1) {
    return false
  } else if (typeof (optionalargs.ruled) === 'undefined' && typeof (
    optionalargs.outputtype) === 'undefined' && Object.keys(
    optionalargs).length !== 0) {
    return false
  } else {
    return true
  }
}
const isargvalid = function (outputtype) {
  return supportedoutputtypes.concat(['pdf']).includes(outputtype)
}
const wraptext = function (text, batchsize) {
  const paragraph = []
  let line = []
  for (let i = 0; i < text.length; i += 1) {
    if (alphanum.includes(text[i])) {
      line.push(Buffer.from(dataset[text[i]][randint(6)]))
    } else if (symbols.includes(text[i])) {
      line.push(Buffer.from(dataset[
                `symbol${symbols.indexOf(text[i])}`][randint(6)]))
    } else if ((text[i] === ' ' && line.length > batchsize - 2) || text[
      i] === '\n') {
      paragraph.push(line)
      line = []
    } else {
      line.push(Buffer.from(dataset.space[randint(6)]))
    }
  }
  paragraph.push(line)
  return paragraph
}
const texttohandwriting = async function (paragraph, width, ruled, batchsize) {
  for (let i = 0; i < paragraph.length; i += 1) {
    const n = width - paragraph[i].length
    for (let j = 0; j < n; j += 1) {
      paragraph[i].push(Buffer.from(dataset.space[randint(6)]))
    }
  }
  const k = []
  for (let i = 0; i < paragraph.length; i += 1) {
    const img = await mergeimg(paragraph[i])
    k.push(img)
  }
  const blankline = []
  for (let i = 0; i < width; i += 1) {
    blankline.push(Buffer.from(dataset.space[randint(6)]))
  }
  const bl = await mergeimg(blankline)
  const n = (batchsize - (k.length % batchsize)) % batchsize
  for (let i = 0; i < n; i += 1) {
    k.push(bl)
  }
  if (ruled) {
    const margin = []
    for (let i = 0; i < width; i += 1) {
      margin.push(Buffer.from(dataset.line[randint(6)]))
    }
    const line = await mergeimg(margin)
    const linebuf = await getbufferasync(line, 'png')
    for (let i = 0; i < k.length; i += 1) {
      k[i] = await mergeimg([k[i], {
        src: linebuf,
        offsetX: -18 * width
      }])
    }
  }
  return k
}
const getret = async function (text, outputtype, ruled) {
  const batchsize = getbatchsize()
  const paragraph = wraptext(text, batchsize)
  const width = getwidth(paragraph, batchsize)
  const k = await texttohandwriting(paragraph, width, ruled, batchsize)
  const result = createbatches(k, batchsize)
  if (outputtype === 'pdf') {
    const type = supportedoutputtypes[Math.floor(Math.random() *
            supportedoutputtypes.length)]
    let imgarr
    if (type.slice(-4, 0) === '/b64') {
      imgarr = await getimages(result, type.slice(0, -4),
        getbas64async)
    } else {
      imgarr = await getimages(result, type.slice(0, -4),
        getbufferasync)
    }
    return generatepdf(imgarr)
  } else {
    if (outputtype.slice(-4, 0) === '/buf') {
      return await getimages(result, outputtype.slice(0, -4),
        getbufferasync)
    } else {
      return await getimages(result, outputtype.slice(0, -4),
        getbas64async)
    }
  }
}
const main = async function (rawtext = '', optionalargs = {}) {
  if (!checkargtype(rawtext, optionalargs)) {
    throw {
      error: 'Invalid arguments type!'
    }
  } else {
    const outputtype = optionalargs.outputtype || 'pdf'
    const ruled = optionalargs.ruled || false
    if (!isargvalid(outputtype)) {
      throw {
        error: `Invalid output type "${outputtype}"!`,
        supportedoutputtypes: supportedoutputtypes.concat(
          ['pdf']),
        default: 'pdf'
      }
    } else {
      const text = cleantext(rawtext)
      if (text.length === 0) {
        if (outputtype === 'pdf') {
          return generatepdf([])
        } else {
          return []
        }
      } else {
        return await getret(text, outputtype, ruled)
      }
    }
  }
}
module.exports = main
