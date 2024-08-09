find "$1" -name "*.mp4" -print0 | while read -r -d $'\0' file
do
      OUT="${file%.*}.tmp.mp4";
      echo "Converting $file to $OUT";
      ffmpeg -nostdin -y -v error -hide_banner -loglevel error -i "$file" \
        -c:v libx264 -crf 23 -profile:v baseline -level 3.0 -pix_fmt yuv420p \
        -c:a aac -ac 2 -b:a 128k \
        -movflags faststart \
        "$OUT" || exit 1;
      echo "Deleting $file";
      rm "$file" || exit 1;
      echo "Moving $OUT to $file";
      mv "$OUT" "$file" || exit 1;
done
