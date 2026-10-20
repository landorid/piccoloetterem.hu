#!/bin/sh
# Resizes the restaurant photos for `/` into public/photos, at two widths each (macOS `sips`).
# Usage: scripts/photos.sh <folder with the IMG_*.png originals>
set -eu
src=$1
out=$(dirname "$0")/../public/photos

photo() {
  for w in 600 1080; do
    sips -s format jpeg -s formatOptions 65 --resampleWidth "$w" "$src/$1" --out "$out/$2-$w.jpg" >/dev/null
  done
}

photo IMG_2888.png terem-ablak
photo IMG_2887.png terem-hosszu
photo IMG_2889.png terem-boxok
photo IMG_2890.png terem-ora
photo IMG_2896.png bejarat
