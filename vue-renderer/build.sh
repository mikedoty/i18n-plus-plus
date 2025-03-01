npm run build;

for f in `find dist/assets -name 'index*css'`; do
    mv $f dist/assets/vue-renderer.css;
done;

for f in `find dist/assets -name 'index*js'`; do
    mv $f dist/assets/vue-renderer.js;
done;

cp dist/assets/vue-renderer* ../extension/dist/assets/;