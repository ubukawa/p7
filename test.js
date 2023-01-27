//module
const config = require('config')

//const
let host 
let port
let Z
let dbUser
let dbPassword
let relations
let propertyBlacklist
let mbtilesDir
let conversionTilelist

// inputs from the command (with default value)
let reg = "e"
let hostSv = "osm"
let format = "mbtiles"

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

if (hostSv == 'un') { //default is osm
    host = config.get('un-l.host')
    port = config.get('un-l.port') 
    Z = config.get('un-l.Z')
    dbUser = config.get('un-l.dbUser')
    dbPassword = config.get('un-l.dbPassword')
    relations = config.get('un-l.relations')
    propertyBlacklist = config.get('un-l.propertyBlacklist')
    mbtilesDir = config.get('un-l.mbtilesDir')
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
        conversionTilelist = config.get(`day0${reg}Tilelist`)       
    } else {
        mbtilesDir = config.get('osm-l.mbtilesDir_every')
        conversionTilelist = config.get('everydayTilelist')
    }
} 

console.log(`HostDB: ${hostSv}, region(osm): ${reg} `)
console.log(host)
console.log(port)
console.log(Z)
console.log(dbUser)
console.log(dbPassword)
console.log(relations)
console.log(mbtilesDir)
console.log(conversionTilelist)

console.log(format)


