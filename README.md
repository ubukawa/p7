# p7
produce for gsc data (7th generation after unvt/produce-gsc-6 )

# environment
* Tippecanoe (v2.17 or later if you want to try pmtiles)
* nodejs v.18

# Usage
1. Edit the config/default.hjson

2. run the command

UN base conversion 

```
node index-l.js -h=un
```

For osm base conversion
```
node index-l -h=osm -r=1
```


-h indicates the database we use. -h=un for UN base while -h=osm for osm_planet (default osm).  
-r indicates the regions we use. -r=e for everyday conversion area, while 1 to 7 is for day1 to day7 (default 'e').
-f indicates the format we use. -f=mbtiles for mbtiles creation, and -f=pmtiles for pmtiles creattion. Make sure that your tippecanoe is v2.17 or later one when you create pmtiles.




# Improvement since the previous one
* testing if the scripts work on nodejs version 18.
* Use of ST_TileEnvelope --> I realized that this will not make a significant change in conversion. I will not use this. (And, mapbox/tile belt is still needed out side PostGIS query.)
* conversion region is given in the command.
* Optional output of tiles in pmtiles format.


