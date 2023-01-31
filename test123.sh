#!/bin/bash
# run this sh like ./test123.sh 1  (1, 2, 3, 4, 5, 6, 7, or e)
##############################
# 27 Jan 2023 by T Ubukawa
##############################
day=${1}; # input from command
format=mbtiles
#format=pmtiles
#edit parameteres (until here)

if [ $day = 'e' ]; then
  tile=every
else
  tile=day0$day
fi

### Running update of the osm tiles for each region
echo "node index_l.js -r=$day";
#node index_l.js -r=$day

### Joining osm tile with un tile, then save it in large_tiles
#for f in produce-gsc-osm/$format/osm_tile_$tile/*.$format; do echo /usr/local/bin/tile-join --no-tile-size-limit -f -o large_tiles/unosm/tile_$tile/`basename ${f}` produce-un/$format/un_tile/`basename ${f}` produce-osm/$format/osm_tile_$tile/`basename ${f}`; date; echo `basename ${f}`; ls -alh large_tiles/unosm/tile_$tile/`basename ${f}` ;done;
for f in produce-gsc-osm/$format/osm_tile_$tile/*.$format; do /usr/local/bin/tile-join --no-tile-size-limit -f -o large_tiles/unosm/tile_$tile/`basename ${f}` produce-un/$format/un_tile/`basename ${f}` produce-osm/$format/osm_tile_$tile/`basename ${f}`; date; echo  `basename ${f}`; ls -alh large_tiles/unosm/tile_$tile/`basename ${f}` ;done

echo scp -i XXX -r ./large_tiles/unosm/tile_$tile/* username@hostingserver:path/$format/unosm
#scp -i XXX(path to your ssh key) -r ./large_tiles/unosm/tile_day01/* (username)@(hostingserver):(path)/mbtiles/unosm
