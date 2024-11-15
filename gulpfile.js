import gulp from 'gulp';
import concat from 'gulp-concat';
import cleanCSS from 'gulp-clean-css';
import terser from 'gulp-terser';
import sourcemaps from 'gulp-sourcemaps';
import plumber from 'gulp-plumber';
import rename from 'gulp-rename';

// Paths
const paths = {
  src: 'src/**/*', // Source directory
  snippets: 'snippets/', // Shopify snippets directory
  assets: 'assets/', // Shopify assets directory
};

// Task: Copy Liquid Files with Prefix
export function copyLiquid() {
  return gulp
    .src('src/**/*.liquid') // Find all .liquid files
    .pipe(
      rename((path) => {
        path.dirname = '';
        path.basename = `vb-${path.basename}`; // Add 'vb-' prefix
      })
    )
    .pipe(gulp.dest(paths.snippets)); // Copy to snippets folder
}

// Task: Bundle CSS with Prefix
export function bundleCSS() {
  return gulp
    .src('src/**/*.css') // Find all CSS files
    .pipe(plumber()) // Prevent errors from breaking the stream
    .pipe(sourcemaps.init()) // Initialize sourcemaps
    .pipe(cleanCSS()) // Minify CSS
    .pipe(concat('vb-styles.css')) // Concatenate with 'vb-' prefix
    .pipe(sourcemaps.write('.')) // Write sourcemaps
    .pipe(gulp.dest(paths.assets)); // Output to assets folder
}

// Task: Bundle JS with Prefix
export function bundleJS() {
  return gulp
    .src('src/**/*.js') // Find all JS files
    .pipe(plumber()) // Prevent errors from breaking the stream
    .pipe(sourcemaps.init()) // Initialize sourcemaps
    .pipe(terser()) // Minify JS
    .pipe(concat('vb-scripts.js')) // Concatenate with 'vb-' prefix
    .pipe(sourcemaps.write('.')) // Write sourcemaps
    .pipe(gulp.dest(paths.assets)); // Output to assets folder
}

// Task: Watch for Changes
export function watchFiles() {
  gulp.watch('src/**/*.liquid', copyLiquid); // Watch and process .liquid files
  gulp.watch('src/**/*.css', bundleCSS); // Watch and process CSS files
  gulp.watch('src/**/*.js', bundleJS); // Watch and process JS files
}

// Default Task
export default gulp.parallel(copyLiquid, bundleCSS, bundleJS); // Run all tasks in parallel
