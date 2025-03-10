echo "MAKE SURE node -v is >= 18!";

# npm run build;
npm run build -- --mode development;

for f in `find dist/assets -name 'index*css'`; do
    mv $f dist/assets/vue-renderer.css;
done;

for f in `find dist/assets -name 'index*js'`; do
    mv $f dist/assets/vue-renderer.js;
done;

cp dist/assets/vue-renderer* ../extension/dist/assets/;
