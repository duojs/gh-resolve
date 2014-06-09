
var resolve = require('./');
var repo = 'yields/k@0.6.2';
var times = 500;

function next(err, tag){
  resolve(repo, function(err, tag){
    if (err) throw err;
  });
}

while (--times) next();
