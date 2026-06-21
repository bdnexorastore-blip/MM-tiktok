const fb = require('fb-downloads');

(async () => {
  try {
    const res = await fb.fbdown('https://www.facebook.com/reel/1083427776483562');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
})();
