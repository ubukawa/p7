# p7
produce for gsc data (7th generation after unvt/produce-gsc-6 )

# environment
* Tippecanoe (v2.17 or later if you want to try pmtiles)
* nodejs v.18

# Usage
UN base conversion
```
node index-l.js -h=un
```

For osm base conversion
```
node index-l -h=osm -r=1
```


# Improvement since the previous one
* testing if the scripts work on nodejs version 18.
* Use of ST_TileEnvelope --> I realized that this will not make a significant change in conversion. I will not use this. (And, mapbox/tile belt is still needed out side PostGIS query.)
* conversion region is given in the command.
* Optional output of tiles in pmtiles format.


