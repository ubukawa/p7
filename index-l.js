// libraries
const config = require('config')
const { spawn } = require('child_process')
const fs = require('fs')
const Queue = require('better-queue')
const pretty = require('prettysize')
const tilebelt = require('@mapbox/tilebelt')
const TimeFormat = require('hh-mm-ss')
const { Pool, Query } = require('pg')
const Spinner = require('cli-spinner').Spinner
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const modify = require('./modify.js')

// config constants
let host 
let port
let Z
let dbUser
let dbPassword
let relations
let propertyBlacklist
let mbtilesDir
let pmtilesDir
let conversionTilelist
let concurrent
const defaultDate = new Date(config.get('defaultDate'))
const logDir = config.get('logDir')
const spinnerString = config.get('spinnerString')
const fetchSize = config.get('fetchSize')
const tippecanoePath = config.get('tippecanoePath')

// inputs from the command (with default value)
let reg = "e"
let hostSv = "osm"
let format = "mbtiles" //for future expansion for pmtiles

for (i = 2; i < process.argv.length; i++ ) {
    //console.log(process.argv[i])
    if (process.argv[i].includes('-r=')){        
        let r = process.argv[i].replace('-r=','')
        r = r.toLowerCase()
        if ( r=='e' || r==1 || r==2 || r==3 || r==4 || r==5 || r==6 || r==7 ){
            reg = r
        }
    }
    if (process.argv[i].includes('-h=')){
        let h = process.argv[i].replace('-h=','')
        h = h.toLowerCase()
        if ( h=='un' || h=='osm' ){
            hostSv = h
        }
    }
    if (process.argv[i].includes('-f=')){
        let fm = process.argv[i].replace('-f=','')
        fm = fm.toLowerCase()
        if ( fm=='mbtiles' || fm=='pmtiles' ){
            format = fm
        }
    }
}

//Setting parameters based on region and host

if (hostSv == 'un') { //in a case "-h=un" (default is osm)
    host = config.get('un-l.host')
    port = config.get('un-l.port') 
    Z = config.get('un-l.Z')
    dbUser = config.get('un-l.dbUser')
    dbPassword = config.get('un-l.dbPassword')
    relations = config.get('un-l.relations')
    concurrent = config.get('un-l.concurrent')
    propertyBlacklist = config.get('un-l.propertyBlacklist')
    mbtilesDir = config.get('un-l.mbtilesDir')
    pmtilesDir = config.get('un-l.pmtilesDir')
    conversionTilelist = config.get('everydayTilelist').concat(config.get('day01Tilelist')).concat(config.get('day02Tilelist')).concat(config.get('day03Tilelist')).concat(config.get('day04Tilelist')).concat(config.get('day05Tilelist')).concat(config.get('day06Tilelist')).concat(config.get('day07Tilelist'))
} else { //meaning osm
    host = config.get('osm-l.host')
    port = config.get('osm-l.port') 
    Z = config.get('osm-l.Z')
    dbUser = config.get('osm-l.dbUser')
    dbPassword = config.get('osm-l.dbPassword')
    relations = config.get('osm-l.relations')
    propertyBlacklist = config.get('osm-l.propertyBlacklist')
    if (reg !== 'e') {
        mbtilesDir = config.get(`osm-l.mbtilesDir_day0${reg}`)
        pmtilesDir = config.get(`osm-l.pmtilesDir_day0${reg}`)
        conversionTilelist = config.get(`day0${reg}Tilelist`)  
        concurrent = config.get('osm-l.concurrentE')    
    } else {
        mbtilesDir = config.get('osm-l.mbtilesDir_every')
        pmtilesDir = config.get('osm-l.pmtilesDir_every')
        conversionTilelist = config.get('everydayTilelist')
        concurrent = config.get('osm-l.concurrent') 
    }
} 

let outDirectory
if (format == 'pmtiles'){
  outDirectory = pmtilesDir
} else {
  outDirectory = mbtilesDir
}

// global configurations
Spinner.setDefaultSpinnerString(spinnerString)
winston.configure({
  level: 'silly',
  format: winston.format.simple(),
  transports: [ 
    new DailyRotateFile({
      filename: `${logDir}/produce-everyday-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
  ]
})

// global variable
let idle = true
let wtps
let modules = {}
let sar
let pools = {}
let productionSpinner = new Spinner()
let moduleKeysInProgress = []

const isIdle = () => {
  return idle
}

// all scores are zero because we cannot login as unix user
const getScores = async () => {
  return new Promise(async (resolve, reject) => {
    // identify modules to update
    let oldestDate = new Date()

//Replaced loop (based on the list)
    for (const moduleKey of conversionTilelist) {
      const path = `${outDirectory}/${moduleKey}.${format}`
      let mtime = defaultDate
      let size = 0
      if (fs.existsSync(path)) {
        let stat = fs.statSync(path)
        mtime = stat.mtime
        size = stat.size
      }
      oldestDate = (oldestDate < mtime) ? oldestDate : mtime
      modules[moduleKey] = {
        mtime: mtime,
        size: size,
       score: 0
      }
    }

    resolve()
  })
}

const iso = () => {
  return (new Date()).toISOString()
}

const noPressureWrite = (downstream, f) => {
  return new Promise((res) => {
    if (downstream.write(`\x1e${JSON.stringify(f)}\n`)) {
      res()
    } else {
      downstream.once('drain', () => { 
        res()
      })
    }
  })
}

const fetch = (client, database, table, downstream) => {
  return new Promise((resolve, reject) => {
    let count = 0
    let features = []
    client.query(new Query(`FETCH ${fetchSize} FROM cur`))
    .on('row', row => {
      let f = {
        type: 'Feature',
        properties: row,
        geometry: JSON.parse(row.st_asgeojson)
      }
      delete f.properties.st_asgeojson
      f.properties._database = database
      f.properties._table = table
      count++
      f = modify(f)
      if (f) features.push(f)
    })
    .on('error', err => {
      console.error(err.stack)
      reject()
    })
    .on('end', async () => {
      for (f of features) {
        try {
          await noPressureWrite(downstream, f)
        } catch (e) {
          reject(e)
        }
      }
      resolve(count)
    })
  })
}

const dumpAndModify = async (bbox, relation, downstream, moduleKey) => {
  return new Promise((resolve, reject) => {
    const startTime = new Date()
//    const [database, table] = relation.split('::')
    const [database, schema, table] = relation.split('::')
    if (!pools[database]) {
      pools[database] = new Pool({
        host: host,
        user: dbUser,
        port: port,
        password: dbPassword,
        database: database
      })
    }
    pools[database].connect(async (err, client, release) => {
      if (err) throw err
      let sql = `
SELECT column_name FROM information_schema.columns 
 WHERE table_name='${table}' AND table_schema='${schema}' ORDER BY ordinal_position`

      let cols = await client.query(sql)
      cols = cols.rows.map(r => r.column_name).filter(r => r !== 'geom')
      cols = cols.filter(v => !propertyBlacklist.includes(v))
      // ST_AsGeoJSON(ST_Intersection(ST_MakeValid(${table}.geom), envelope.geom))
      cols.push(`ST_AsGeoJSON(${schema}.${table}.geom)`)
      await client.query(`BEGIN`)
      sql = `
DECLARE cur CURSOR FOR 
WITH 
  envelope AS (SELECT ST_MakeEnvelope(${bbox.join(', ')}, 4326) AS geom)
SELECT 
  ${cols.toString()}
FROM ${schema}.${table}
JOIN envelope ON ${schema}.${table}.geom && envelope.geom
` 
      cols = await client.query(sql)
      try {
        while (await fetch(client, database, table, downstream) !== 0) {}
      } catch (e) {
        reject(e)
      }
      await client.query(`COMMIT`)
      winston.info(`${iso()}: finished ${relation} of ${moduleKey}`)
      release()
      resolve()
    })
  })
}

const sleep = (wait) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => { resolve() }, wait)
  })
}

const queue = new Queue(async (t, cb) => {
  const startTime = new Date()
  const moduleKey = t.moduleKey
  const queueStats = queue.getStats()
  const [z, x, y] = moduleKey.split('-').map(v => Number(v))
  const bbox = tilebelt.tileToBBOX([x, y, z])
  const tmpPath = `${outDirectory}/part-${moduleKey}.${format}`
  const dstPath = `${outDirectory}/${moduleKey}.${format}`

  moduleKeysInProgress.push(moduleKey)
  productionSpinner.setSpinnerTitle(moduleKeysInProgress.join(', '))

  const tippecanoe = spawn(tippecanoePath, [
    '--quiet',
    '--no-feature-limit',
    '--no-tile-size-limit',
    '--force',
    '--simplification=2',
    `--minimum-zoom=${Z}`,
    '--maximum-zoom=15',
    '--base-zoom=15',
    '--hilbert',
    `--clip-bounding-box=${bbox.join(',')}`,
    `--output=${tmpPath}`
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  tippecanoe.on('exit', () => {
    fs.renameSync(tmpPath, dstPath)
    moduleKeysInProgress = moduleKeysInProgress.filter((v) => !(v === moduleKey))
    productionSpinner.stop()
    process.stdout.write('\n')
    const logString = `${iso()}: [${queueStats.total + 1}/${queueStats.peak}] process ${moduleKey} (score: ${modules[moduleKey].score}, ${pretty(modules[moduleKey].size)} => ${pretty(fs.statSync(dstPath).size)}) took ${TimeFormat.fromMs(new Date() - startTime)} wtps=${wtps}.`
    winston.info(logString)
    console.log(logString)
    if (moduleKeysInProgress.length !== 0) {
      productionSpinner.setSpinnerTitle(moduleKeysInProgress.join(', '))
      productionSpinner.start()
    }
    return cb()
  })

  productionSpinner.start()
  for (relation of relations) {
    while (!isIdle()) {
      winston.info(`${iso()}: short break due to heavy disk writes (wtps=${wtps}).`)
      await sleep(5000)
    }
    try {
      await dumpAndModify(bbox, relation, tippecanoe.stdin, moduleKey)
    } catch (e) {
      winston.error(e)
      cb(true)
    }
  }
  tippecanoe.stdin.end()
}, { 
  concurrent: concurrent, 
  maxRetries: config.get('maxRetries'),
  retryDelay: config.get('retryDelay') 
})

const queueTasks = () => {
  let moduleKeys = Object.keys(modules)
  moduleKeys.sort((a, b) => modules[b].score - modules[a].score)

  for (let moduleKey of moduleKeys) {
//for (let moduleKey of conversionTilelist) {
//  for (let moduleKey of ['6-34-30','6-34-31','6-34-32','6-35-30','6-35-31','6-35-32','6-36-30','6-36-31','6-36-32','6-37-30','6-37-31','6-37-32','6-38-30','6-38-31','6-38-32']) { //// TEMP
    //if (modules[moduleKey].score > 0) {
      queue.push({
        moduleKey: moduleKey
      })
    //}
  }
}

// shutdown this system
const shutdown = () => {
  winston.info(`${iso()}: production system shutdown.`)
  console.log('** production system shutdown! **')
  process.exit(0)
}

const main = async () => {
  winston.info(`${iso()}: Everyday tile production started.`)
  await getScores()
  queueTasks()
  queue.on('drain', () => {
    shutdown()
  })
}

main()
