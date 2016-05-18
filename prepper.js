const fs		= require('fs');
const spawn		= require('child_process').spawn;
const _			= require('lodash');
const readline		= require('readline');
const path		= require('path');
const mkdirp		= require('mkdirp');

const inputPath		= process.argv[2];
const outputPath	= process.argv[3];

const semiColonRx	= /(^[^:]+): line ([0-9]+), col ([0-9]+), Missing semicolon/;
const linesRx		= /[^\r\n]+/g;

var counters = {
	files:	0,
	edits:	0,
	written:0,
};

var child = spawn('jshint', [
  inputPath
]);

process.on('exit', function() {
	console.log("Made " + counters.edits + " edits in " + counters.files + " input files. Wrote " + counters.written + " output files.");
});

child.stdout.on('data', function(chunk) {
	var output	= chunk.toString();
	var lines	= output.match(linesRx);
	var targets	= [];

	lines.forEach(
		function (line) {
			var match	= line.match(semiColonRx);
			if (match) {
				targets.push({
					filename:	match[1],
					lineNumber:	match[2],
					column:		match[3],
				});
			}
		});
	targets = _.groupBy(targets, 'filename');
	_.each(targets, function (target, filename) {
		counters.files++;
		var subPath	= path.relative(inputPath, filename);
		var outfile	= path.join(outputPath, subPath);
		var outpath	= path.dirname(outfile);
		mkdirp(outpath, function(err) {
			if (err) { throw err; }
			var writeStream = fs.createWriteStream(outfile);
			writeStream.on('open', function(ostream) {
				var rd = readline.createInterface({
					input: fs.createReadStream(filename)
				});
				var lineTargets = _.groupBy(target, 'lineNumber');
				var number = 0;
				rd.on('end', function() {
					writeStream.end();
					counters.written++;
				});
				rd.on('line', function(line) {
					number++;
					if (lineTargets.hasOwnProperty(number)) {
						lineTargets[number].forEach(function(t) {
							counters.edits++;
							var chars = line.split('');
							chars.splice(t.column, 0, ";");
							line = chars.join('');
						});
					}
					writeStream.write(line + '\n');
				});
			});
		});
	});
});

child.stderr.on('data', function(chunk) {
	console.log('e', chunk);
});
